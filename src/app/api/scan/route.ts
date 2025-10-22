/**
 * Reddit Scan API Endpoint
 * POST /api/scan
 *
 * Triggers a manual scan of specified subreddit(s)
 * Returns aggregated ticker mentions with sentiment analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createScanner } from '@/lib/scanner/scanner';

// Configuration from environment variables
const REDDIT_CONFIG = {
  clientId: process.env.REDDIT_CLIENT_ID || '',
  clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
  userAgent: process.env.REDDIT_USER_AGENT || 'MemeRadar/1.0',
};

export async function POST(request: NextRequest) {
  try {
    // Validate Reddit credentials
    if (!REDDIT_CONFIG.clientId || !REDDIT_CONFIG.clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reddit API credentials not configured. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment variables.',
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { subreddit, subreddits, limit = 25 } = body;

    // Validate input
    if (!subreddit && !subreddits) {
      return NextResponse.json(
        {
          success: false,
          error: 'Must provide either "subreddit" (string) or "subreddits" (array)',
        },
        { status: 400 }
      );
    }

    // Create scanner instance
    const scanner = createScanner(REDDIT_CONFIG);

    // Scan single or multiple subreddits
    let results;
    if (subreddit) {
      // Single subreddit
      const result = await scanner.scanSubreddit(subreddit, limit);
      results = [result];
    } else {
      // Multiple subreddits
      if (!Array.isArray(subreddits)) {
        return NextResponse.json(
          {
            success: false,
            error: '"subreddits" must be an array of subreddit names',
          },
          { status: 400 }
        );
      }
      results = await scanner.scanMultipleSubreddits(subreddits, limit);
    }

    // Convert Map to object for JSON serialization
    const serializedResults = results.map((result) => ({
      ...result,
      tickers: Object.fromEntries(result.tickers),
    }));

    return NextResponse.json({
      success: true,
      data: {
        results: serializedResults,
        summary: {
          totalSubreddits: results.length,
          totalPosts: results.reduce((sum, r) => sum + r.stats.totalPosts, 0),
          totalComments: results.reduce((sum, r) => sum + r.stats.totalComments, 0),
          totalUniqueTickers: new Set(
            results.flatMap((r) => Array.from(r.tickers.keys()))
          ).size,
          totalMentions: results.reduce((sum, r) => sum + r.stats.totalMentions, 0),
        },
      },
    });
  } catch (error: any) {
    console.error('Scan API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing (returns instructions)
export async function GET() {
  return NextResponse.json({
    message: 'Reddit Scan API Endpoint',
    usage: {
      method: 'POST',
      body: {
        subreddit: 'Single subreddit name (string)',
        subreddits: 'Multiple subreddit names (array)',
        limit: 'Number of posts to fetch per subreddit (default: 25)',
      },
      examples: [
        {
          description: 'Scan single subreddit',
          body: {
            subreddit: 'wallstreetbets',
            limit: 10,
          },
        },
        {
          description: 'Scan multiple subreddits',
          body: {
            subreddits: ['wallstreetbets', 'stocks', 'investing'],
            limit: 25,
          },
        },
      ],
    },
    note: 'Requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment variables',
  });
}
