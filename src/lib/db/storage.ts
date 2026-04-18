/**
 * Storage Layer for Stock Mention Data
 * Handles saving and retrieving stock mentions from DynamoDB
 */

import { docClient, TABLES, PutCommand, QueryCommand, ScanCommand } from './client';
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
  rank24hAgo?: number | null;   // null when < 24h of history or ticker is new; set by getTrendingStocks
  rankDelta24h?: number | null; // positive = climbed (was rank 5, now rank 2 → +3)
  rankStatus?: 'climbing' | 'falling' | 'new' | 'steady' | 'unknown';
  //   climbing = positive delta; falling = negative; steady = 0; new = no prior entry; unknown = < 24h history
}

// 5-minute in-memory cache for 24h rank snapshots (one entry per timestamp bucket)
let _rankSnapshotCache: { timestamp: number; data: Map<string, number>; fetchedAt: number } | null = null;

/** For tests only — clears the rank snapshot cache so tests start with a clean slate. */
export function clearRankSnapshotCache(): void {
  _rankSnapshotCache = null;
}

/**
 * Round timestamp to 15-minute intervals
 * This groups data into consistent time buckets
 */
export function roundToInterval(timestamp: number, intervalMs: number = 15 * 60 * 1000): number {
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

/**
 * Build a ticker→rank map for a given timestamp bucket.
 * Ranks are determined by mentionCount descending (rank 1 = most mentions).
 * Results are cached for 5 minutes to avoid redundant DynamoDB queries per request.
 */
export async function getRankSnapshot(timestamp: number): Promise<Map<string, number>> {
  if (
    _rankSnapshotCache &&
    _rankSnapshotCache.timestamp === timestamp &&
    Date.now() - _rankSnapshotCache.fetchedAt < 5 * 60 * 1000
  ) {
    return _rankSnapshotCache.data;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_MENTIONS,
      IndexName: 'timestamp-index',
      KeyConditionExpression: '#timestamp = :timestamp',
      ExpressionAttributeNames: { '#timestamp': 'timestamp' },
      ExpressionAttributeValues: { ':timestamp': timestamp },
    })
  );

  const items = (result.Items || []).slice().sort(
    (a, b) => (b.mentionCount as number) - (a.mentionCount as number)
  );
  const rankMap = new Map<string, number>();
  items.forEach((item, idx) => rankMap.set(item.ticker as string, idx + 1));

  _rankSnapshotCache = { timestamp, data: rankMap, fetchedAt: Date.now() };
  return rankMap;
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
 *
 * ALGORITHM: Velocity-based ranking
 * ─────────────────────────────────
 * 1. Fetch all stock mentions from the CURRENT 15-minute bucket
 * 2. Fetch all stock mentions from the PREVIOUS 15-minute bucket
 * 3. For each stock in the current bucket:
 *    - velocity = ((current - previous) / previous) * 100   (% change)
 *    - If the stock is new (no previous data), velocity = 100%
 * 4. Filter: only stocks with >= 5 mentions in the current bucket qualify
 * 5. Sort by velocity descending → top N are "trending"
 *
 * NOTE: The CLAUDE.md spec calls for 1-hour windows, but the implementation
 * uses 15-minute windows for faster signal detection. This is intentional —
 * 1-hour windows are too slow for a meme stock tracker.
 */
export async function getTrendingStocks(limit: number = 10): Promise<TrendingStock[]> {
  const now = roundToInterval(Date.now());
  const previousInterval = now - 15 * 60 * 1000; // Previous 15-min bucket

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
  const trending: Omit<TrendingStock, 'rank24hAgo' | 'rankDelta24h' | 'rankStatus'>[] = [];
  for (const item of currentData.Items || []) {
    const current = item.mentionCount as number;
    const previous = previousMap.get(item.ticker as string) || 0;

    // Calculate velocity (% change)
    const velocity = previous > 0 ? ((current - previous) / previous) * 100 : 100;

    // Only include stocks with at least 5 mentions
    if (current >= 5) {
      trending.push({
        ticker: item.ticker as string,
        mentionCount: current,
        sentimentScore: item.avgSentimentScore as number,
        sentimentCategory: item.sentimentCategory as string,
        velocity,
        timestamp: now,
      });
    }
  }

  // Sort by velocity descending, slice to limit
  const sorted = trending.sort((a, b) => b.velocity - a.velocity).slice(0, limit);

  // Compute 24h rank delta: query the snapshot from 24h ago
  const timestamp24hAgo = now - 24 * 60 * 60 * 1000;
  const snapshot24h = await getRankSnapshot(timestamp24hAgo);
  const hasHistory = snapshot24h.size > 0;

  return sorted.map((stock, idx): TrendingStock => {
    const currentRank = idx + 1;
    const pastRank = snapshot24h.get(stock.ticker) ?? null;

    let rankDelta24h: number | null = null;
    let rankStatus: TrendingStock['rankStatus'] = 'unknown';

    if (!hasHistory) {
      rankStatus = 'unknown';
    } else if (pastRank === null) {
      rankStatus = 'new';
    } else {
      rankDelta24h = pastRank - currentRank; // positive = climbed
      if (rankDelta24h > 0) rankStatus = 'climbing';
      else if (rankDelta24h < 0) rankStatus = 'falling';
      else rankStatus = 'steady';
    }

    return { ...stock, rank24hAgo: pastRank, rankDelta24h, rankStatus };
  });
}

/**
 * Get fading stocks (losing interest)
 *
 * ALGORITHM: Inverse velocity ranking
 * ────────────────────────────────────
 * 1. Fetch up to 100 stocks using getTrendingStocks (which includes all stocks >= 5 mentions)
 * 2. Filter to only stocks with NEGATIVE velocity (mentions declining)
 * 3. Sort by velocity ascending (most negative = biggest drop = rank #1)
 * 4. Return top N
 *
 * NOTE: The CLAUDE.md spec requires minimum 10 mentions in the PREVIOUS period.
 * Current implementation requires >= 5 mentions in the CURRENT period (via getTrendingStocks).
 */
export async function getFadingStocks(limit: number = 10): Promise<TrendingStock[]> {
  const trending = await getTrendingStocks(100); // Get more stocks first

  // Filter for negative velocity and sort ascending (biggest drops first)
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

/**
 * Get time breakdown stats for a ticker (24hr, 7d, 30d)
 */
export async function getStockTimeBreakdown(ticker: string): Promise<{
  periods: { label: string; mentions: number; bullishPct: number; neutralPct: number; bearishPct: number }[];
}> {
  const now = Date.now();
  const periods = [
    { label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
    { label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: '30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
  ];

  const results = await Promise.all(
    periods.map(async (period) => {
      const startTime = now - period.ms;

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLES.STOCK_MENTIONS,
          KeyConditionExpression: 'ticker = :ticker AND #ts BETWEEN :start AND :end',
          ExpressionAttributeNames: { '#ts': 'timestamp' },
          ExpressionAttributeValues: {
            ':ticker': ticker,
            ':start': startTime,
            ':end': now,
          },
        })
      );

      const items = result.Items || [];
      const totalMentions = items.reduce((sum: number, i: Record<string, unknown>) => sum + (Number(i.mentionCount) || 0), 0);
      const totalBullish = items.reduce((sum: number, i: Record<string, unknown>) => sum + (Number(i.bullishCount) || 0), 0);
      const totalBearish = items.reduce((sum: number, i: Record<string, unknown>) => sum + (Number(i.bearishCount) || 0), 0);
      const totalNeutral = items.reduce((sum: number, i: Record<string, unknown>) => sum + (Number(i.neutralCount) || 0), 0);
      const total = totalBullish + totalBearish + totalNeutral;

      return {
        label: period.label,
        mentions: totalMentions,
        bullishPct: total > 0 ? Math.round((totalBullish / total) * 100) : 0,
        neutralPct: total > 0 ? Math.round((totalNeutral / total) * 100) : 0,
        bearishPct: total > 0 ? Math.round((totalBearish / total) * 100) : 0,
      };
    })
  );

  return { periods: results };
}

/**
 * Get historical data for charts (mention count and sentiment over time)
 */
export async function getStockHistory(ticker: string, days: number = 7): Promise<{
  mentions: { label: string; value: number }[];
  sentiment: { label: string; value: number }[];
}> {
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_MENTIONS,
      KeyConditionExpression: 'ticker = :ticker AND #ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':ticker': ticker,
        ':start': startTime,
        ':end': now,
      },
      ScanIndexForward: true,
    })
  );

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mentionBuckets = new Map<string, number>();
  const sentimentBuckets = new Map<string, { total: number; count: number }>();

  // Initialize buckets for each day
  for (let d = 0; d < days; d++) {
    const dayTs = startTime + d * 24 * 60 * 60 * 1000;
    const date = new Date(dayTs);
    const label = `${dayNames[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
    mentionBuckets.set(label, 0);
    sentimentBuckets.set(label, { total: 0, count: 0 });
  }

  for (const item of result.Items || []) {
    const date = new Date(item.timestamp);
    const label = `${dayNames[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
    mentionBuckets.set(label, (mentionBuckets.get(label) || 0) + (item.mentionCount || 0));
    const entry = sentimentBuckets.get(label) || { total: 0, count: 0 };
    entry.total += item.avgSentimentScore || 0;
    entry.count += 1;
    sentimentBuckets.set(label, entry);
  }

  const mentions = Array.from(mentionBuckets.entries()).map(([label, value]) => ({ label, value }));
  const sentiment = Array.from(sentimentBuckets.entries()).map(([label, { total, count }]) => ({
    label,
    value: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
  }));

  return { mentions, sentiment };
}

/**
 * Get sparkline data for a ticker (mention counts over last 7 days)
 * Returns an array of daily mention counts, oldest first
 */
export async function getSparklineData(ticker: string, days: number = 7): Promise<number[]> {
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_MENTIONS,
      KeyConditionExpression: 'ticker = :ticker AND #ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':ticker': ticker,
        ':start': startTime,
        ':end': now,
      },
      ScanIndexForward: true,
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return [];
  }

  // Aggregate into daily buckets
  const dailyBuckets = new Map<number, number>();
  for (let d = 0; d < days; d++) {
    const dayStart = startTime + d * 24 * 60 * 60 * 1000;
    const dayKey = Math.floor(dayStart / (24 * 60 * 60 * 1000));
    dailyBuckets.set(dayKey, 0);
  }

  for (const item of result.Items) {
    const dayKey = Math.floor(item.timestamp / (24 * 60 * 60 * 1000));
    dailyBuckets.set(dayKey, (dailyBuckets.get(dayKey) || 0) + (item.mentionCount || 0));
  }

  return Array.from(dailyBuckets.values());
}
