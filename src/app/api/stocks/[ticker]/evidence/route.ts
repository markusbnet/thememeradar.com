/**
 * Stock Evidence API Endpoint
 * Returns raw posts and comments that mention a specific stock ticker
 */

import { NextRequest, NextResponse } from 'next/server';
import { docClient, TABLES } from '@/lib/db/dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';

interface Evidence {
  ticker: string;
  evidenceId: string;
  type: 'post' | 'comment';
  text: string;
  keywords: string[];
  sentimentScore: number;
  sentimentCategory: string;
  upvotes: number;
  subreddit: string;
  createdAt: number;
  redditUrl?: string;
}

/**
 * Construct Reddit URL from evidence
 */
function getRedditUrl(evidence: Evidence): string {
  const { subreddit, evidenceId, type } = evidence;

  if (type === 'post') {
    // Post URL: reddit.com/r/{subreddit}/comments/{postId}
    return `https://reddit.com/r/${subreddit}/comments/${evidenceId}`;
  } else {
    // Comment URL: reddit.com/r/{subreddit}/comments/{postId}/_/{commentId}
    // Note: We don't have postId for comments in evidence table currently
    // This is a known gap - see REMEDIATION_PLAN.md
    return `https://reddit.com/r/${subreddit}`;
  }
}

/**
 * GET /api/stocks/[ticker]/evidence
 * Returns top posts and comments for a stock (by upvotes)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Query evidence table for this ticker
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.STOCK_EVIDENCE,
        KeyConditionExpression: 'ticker = :ticker',
        ExpressionAttributeValues: {
          ':ticker': ticker,
        },
        Limit: Math.min(limit, 100), // Cap at 100
        ScanIndexForward: false, // Most recent first
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No evidence found for this ticker' },
        { status: 404 }
      );
    }

    // Sort by upvotes (descending) and add Reddit URLs
    const evidence: Evidence[] = (result.Items as Evidence[])
      .sort((a, b) => b.upvotes - a.upvotes)
      .map(item => ({
        ...item,
        redditUrl: getRedditUrl(item),
      }));

    return NextResponse.json({
      success: true,
      data: {
        ticker,
        count: evidence.length,
        evidence,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to fetch stock evidence: ${message}` },
      { status: 500 }
    );
  }
}
