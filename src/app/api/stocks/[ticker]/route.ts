/**
 * Stock Detail API Endpoint
 * Returns detailed information for a specific stock ticker
 */

import { NextRequest, NextResponse } from 'next/server';
import { docClient, TABLES } from '@/lib/db/dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';

interface StockMetrics {
  ticker: string;
  current: {
    timestamp: number;
    mentionCount: number;
    uniquePosts: number;
    uniqueComments: number;
    sentimentScore: number;
    sentimentCategory: string;
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
    totalUpvotes: number;
    subredditBreakdown: Record<string, number>;
    topKeywords: string[];
  };
  historical: {
    timestamp: number;
    mentionCount: number;
    sentimentScore: number;
  }[];
}

/**
 * Round timestamp to 15-minute intervals (same as storage.ts)
 */
function roundToInterval(timestamp: number, intervalMs: number = 15 * 60 * 1000): number {
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

/**
 * GET /api/stocks/[ticker]
 * Returns current and historical data for a stock
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase();
    const now = roundToInterval(Date.now());

    // Get current period data
    const currentResult = await docClient.send(
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

    if (!currentResult.Items || currentResult.Items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Stock ticker not found or no recent mentions' },
        { status: 404 }
      );
    }

    const currentData = currentResult.Items[0];

    // Get 7 days of historical data
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const historicalResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.STOCK_MENTIONS,
        KeyConditionExpression: 'ticker = :ticker AND #timestamp BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':ticker': ticker,
          ':start': sevenDaysAgo,
          ':end': now,
        },
      })
    );

    // Format historical data
    const historical = (historicalResult.Items || []).map(item => ({
      timestamp: item.timestamp,
      mentionCount: item.mentionCount,
      sentimentScore: item.avgSentimentScore,
    }));

    const response: StockMetrics = {
      ticker,
      current: {
        timestamp: currentData.timestamp,
        mentionCount: currentData.mentionCount,
        uniquePosts: currentData.uniquePosts,
        uniqueComments: currentData.uniqueComments,
        sentimentScore: currentData.avgSentimentScore,
        sentimentCategory: currentData.sentimentCategory,
        bullishCount: currentData.bullishCount,
        bearishCount: currentData.bearishCount,
        neutralCount: currentData.neutralCount,
        totalUpvotes: currentData.totalUpvotes,
        subredditBreakdown: currentData.subredditBreakdown,
        topKeywords: currentData.topKeywords,
      },
      historical,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to fetch stock details: ${message}` },
      { status: 500 }
    );
  }
}
