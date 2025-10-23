/**
 * Storage Layer for Stock Mention Data
 * Handles saving and retrieving stock mentions from DynamoDB
 */

import { docClient, TABLES, PutCommand, QueryCommand, ScanCommand } from './dynamodb';
import { ScanResult, TickerMention } from '@/lib/scanner/scanner';

// Types for stored data
export interface StoredStockMention {
  ticker: string;
  timestamp: number; // Rounded to 15-min intervals
  mentionCount: number;
  uniquePosts: number;
  uniqueComments: number;
  avgSentimentScore: number;
  sentimentCategory: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalUpvotes: number;
  subredditBreakdown: Record<string, number>;
  topKeywords: string[];
  ttl: number; // Expires after 30 days
}

export interface StoredEvidence {
  ticker: string;
  evidenceId: string; // postId or commentId
  type: 'post' | 'comment';
  text: string;
  keywords: string[];
  sentimentScore: number;
  sentimentCategory: string;
  upvotes: number;
  subreddit: string;
  createdAt: number;
  ttl: number;
}

export interface TrendingStock {
  ticker: string;
  mentionCount: number;
  sentimentScore: number;
  sentimentCategory: string;
  velocity: number; // % change from previous period
  timestamp: number;
}

/**
 * Round timestamp to 15-minute intervals
 * This groups data into consistent time buckets
 */
function roundToInterval(timestamp: number, intervalMs: number = 15 * 60 * 1000): number {
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

/**
 * Calculate TTL (expires in 30 days)
 */
function getTTL(timestamp: number = Date.now()): number {
  return Math.floor(timestamp / 1000) + 30 * 24 * 60 * 60; // 30 days from now
}

/**
 * Save scan results to DynamoDB
 */
export async function saveScanResults(results: ScanResult[]): Promise<void> {
  const timestamp = roundToInterval(Date.now());

  // Aggregate all ticker mentions across subreddits
  const tickerData = new Map<string, {
    mentions: TickerMention[];
    subreddits: Set<string>;
  }>();

  for (const result of results) {
    for (const [ticker, mentions] of result.tickers.entries()) {
      if (!tickerData.has(ticker)) {
        tickerData.set(ticker, { mentions: [], subreddits: new Set() });
      }
      tickerData.get(ticker)!.mentions.push(...mentions);
      tickerData.get(ticker)!.subreddits.add(result.subreddit);
    }
  }

  // Save aggregated data for each ticker
  for (const [ticker, data] of tickerData.entries()) {
    const { mentions } = data;

    // Calculate statistics
    const sentimentScores = mentions.map(m => m.sentiment.score);
    const avgSentiment = sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;

    const bullishCount = mentions.filter(m => m.sentiment.score > 0.2).length;
    const bearishCount = mentions.filter(m => m.sentiment.score < -0.2).length;
    const neutralCount = mentions.length - bullishCount - bearishCount;

    const totalUpvotes = mentions.reduce((sum, m) => sum + m.upvotes, 0);

    // Subreddit breakdown
    const subredditBreakdown: Record<string, number> = {};
    for (const mention of mentions) {
      subredditBreakdown[mention.subreddit] = (subredditBreakdown[mention.subreddit] || 0) + 1;
    }

    // Top keywords (frequency count)
    const keywordCounts = new Map<string, number>();
    for (const mention of mentions) {
      const keywords = [
        ...mention.sentiment.bullishKeywords,
        ...mention.sentiment.bearishKeywords,
      ];
      for (const keyword of keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }
    const topKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);

    // Determine sentiment category
    let sentimentCategory = 'neutral';
    if (avgSentiment > 0.6) sentimentCategory = 'strong_bullish';
    else if (avgSentiment > 0.2) sentimentCategory = 'bullish';
    else if (avgSentiment < -0.6) sentimentCategory = 'strong_bearish';
    else if (avgSentiment < -0.2) sentimentCategory = 'bearish';

    // Save stock mention
    const stockMention: StoredStockMention = {
      ticker,
      timestamp,
      mentionCount: mentions.length,
      uniquePosts: mentions.filter(m => m.source === 'post').length,
      uniqueComments: mentions.filter(m => m.source === 'comment').length,
      avgSentimentScore: Math.round(avgSentiment * 1000) / 1000,
      sentimentCategory,
      bullishCount,
      bearishCount,
      neutralCount,
      totalUpvotes,
      subredditBreakdown,
      topKeywords,
      ttl: getTTL(),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.STOCK_MENTIONS,
        Item: stockMention,
      })
    );

    // Save evidence (top 5 mentions by upvotes)
    const topMentions = mentions
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, 5);

    for (const mention of topMentions) {
      const evidence: StoredEvidence = {
        ticker,
        evidenceId: mention.sourceId,
        type: mention.source,
        text: mention.text,
        keywords: [
          ...mention.sentiment.bullishKeywords,
          ...mention.sentiment.bearishKeywords,
        ],
        sentimentScore: mention.sentiment.score,
        sentimentCategory: mention.sentiment.category,
        upvotes: mention.upvotes,
        subreddit: mention.subreddit,
        createdAt: Date.now(),
        ttl: getTTL(),
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLES.STOCK_EVIDENCE,
          Item: evidence,
        })
      );
    }
  }
}

/**
 * Get trending stocks (rising mentions)
 * Compares current period vs previous period
 */
export async function getTrendingStocks(limit: number = 10): Promise<TrendingStock[]> {
  const now = roundToInterval(Date.now());
  const previousInterval = now - 15 * 60 * 1000; // 15 minutes ago

  // Get current period data
  const currentData = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_MENTIONS,
      IndexName: 'timestamp-index',
      KeyConditionExpression: '#timestamp = :timestamp',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':timestamp': now,
      },
    })
  );

  // Get previous period data
  const previousData = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_MENTIONS,
      IndexName: 'timestamp-index',
      KeyConditionExpression: '#timestamp = :timestamp',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':timestamp': previousInterval,
      },
    })
  );

  // Build map of previous mentions
  const previousMap = new Map<string, number>();
  for (const item of previousData.Items || []) {
    previousMap.set(item.ticker, item.mentionCount);
  }

  // Calculate velocity for current stocks
  const trending: TrendingStock[] = [];
  for (const item of currentData.Items || []) {
    const current = item.mentionCount;
    const previous = previousMap.get(item.ticker) || 0;

    // Calculate velocity (% change)
    const velocity = previous > 0 ? ((current - previous) / previous) * 100 : 100;

    // Only include stocks with at least 5 mentions
    if (current >= 5) {
      trending.push({
        ticker: item.ticker,
        mentionCount: current,
        sentimentScore: item.avgSentimentScore,
        sentimentCategory: item.sentimentCategory,
        velocity,
        timestamp: now,
      });
    }
  }

  // Sort by velocity (descending) and return top N
  return trending.sort((a, b) => b.velocity - a.velocity).slice(0, limit);
}

/**
 * Get fading stocks (losing interest)
 */
export async function getFadingStocks(limit: number = 10): Promise<TrendingStock[]> {
  const trending = await getTrendingStocks(100); // Get more stocks first

  // Filter for negative velocity and sort ascending
  return trending
    .filter(stock => stock.velocity < 0)
    .sort((a, b) => a.velocity - b.velocity)
    .slice(0, limit);
}

/**
 * Get stock details by ticker
 */
export async function getStockDetails(ticker: string): Promise<StoredStockMention | null> {
  const now = roundToInterval(Date.now());

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_MENTIONS,
      KeyConditionExpression: 'ticker = :ticker AND #timestamp = :timestamp',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':ticker': ticker,
        ':timestamp': now,
      },
    })
  );

  return (result.Items?.[0] as StoredStockMention) || null;
}

/**
 * Get evidence for a stock
 */
export async function getStockEvidence(ticker: string, limit: number = 10): Promise<StoredEvidence[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_EVIDENCE,
      KeyConditionExpression: 'ticker = :ticker',
      ExpressionAttributeValues: {
        ':ticker': ticker,
      },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    })
  );

  return (result.Items || []) as StoredEvidence[];
}
