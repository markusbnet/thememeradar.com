/**
 * Reddit Scan API Endpoint
 * GET  /api/scan - Automated cron job (scans default subreddits)
 * POST /api/scan - Manual scan (custom subreddits)
 *
 * Scans Reddit for stock mentions, analyzes sentiment, and saves to DynamoDB
 */

import { NextRequest, NextResponse } from 'next/server';
import { createScanner } from '@/lib/scanner/scanner';
import { saveScanResults } from '@/lib/db/storage';

// Configuration from environment variables
const REDDIT_CONFIG = {
  clientId: process.env.REDDIT_CLIENT_ID || '',
  clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
  userAgent: process.env.REDDIT_USER_AGENT || 'MemeRadar/1.0',
};

// Default subreddits to scan (for cron job)
const DEFAULT_SUBREDDITS = ['wallstreetbets', 'stocks', 'investing'];

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

    // Save results to DynamoDB
    await saveScanResults(results);

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

/**
 * GET endpoint for automated cron job
 * Scans default subreddits and saves results to DynamoDB
 */
export async function GET() {
  try {
    // Validate Reddit credentials
    if (!REDDIT_CONFIG.clientId || !REDDIT_CONFIG.clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reddit API credentials not configured',
        },
        { status: 500 }
      );
    }

    console.log('🔄 Starting automated Reddit scan...');
    console.log(`📡 Scanning subreddits: ${DEFAULT_SUBREDDITS.join(', ')}`);

    // Create scanner instance
    const scanner = createScanner(REDDIT_CONFIG);

    // Scan default subreddits
    const results = await scanner.scanMultipleSubreddits(DEFAULT_SUBREDDITS, 25);

    // Save results to DynamoDB
    await saveScanResults(results);

    // Calculate summary
    const summary = {
      scannedAt: new Date().toISOString(),
      subreddits: DEFAULT_SUBREDDITS,
      totalPosts: results.reduce((sum, r) => sum + r.stats.totalPosts, 0),
      totalComments: results.reduce((sum, r) => sum + r.stats.totalComments, 0),
      totalUniqueTickers: new Set(
        results.flatMap((r) => Array.from(r.tickers.keys()))
      ).size,
      totalMentions: results.reduce((sum, r) => sum + r.stats.totalMentions, 0),
    };

    console.log('✅ Scan completed:', summary);

    return NextResponse.json({
      success: true,
      message: 'Scan completed and saved to database',
      data: summary,
    });
  } catch (error: any) {
    console.error('❌ Automated scan error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Scan failed',
      },
      { status: 500 }
    );
  }
}
