import { logger } from '@/lib/logger';
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

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  return authHeader === `Bearer ${cronSecret}`;
}

// Default subreddits when SCAN_SUBREDDITS env var is not set.
// This set covers the highest-signal communities for meme stocks.
const DEFAULT_SUBREDDITS = [
  'wallstreetbets', 'stocks', 'investing',
  'pennystocks', 'Superstonk', 'StockMarket', 'options',
];

/**
 * Parse the SCAN_SUBREDDITS env var (comma-separated) into a subreddit list.
 * Falls back to DEFAULT_SUBREDDITS when the var is absent or empty.
 * Handles extra whitespace, double commas, and trailing commas gracefully.
 */
export function parseSubredditList(envVar: string | undefined): string[] {
  if (!envVar || envVar.trim() === '') return DEFAULT_SUBREDDITS;
  const parsed = envVar.split(',').map(s => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_SUBREDDITS;
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

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
  } catch (error: unknown) {
    logger.error('Scan API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for automated cron job
 * Scans default subreddits and saves results to DynamoDB
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

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

    const subredditsToScan = parseSubredditList(process.env.SCAN_SUBREDDITS);

    logger.info('🔄 Starting automated Reddit scan...');
    logger.info(`📡 Scanning subreddits: ${subredditsToScan.join(', ')}`);

    // Create scanner instance
    const scanner = createScanner(REDDIT_CONFIG);

    // Scan configured subreddits
    const results = await scanner.scanMultipleSubreddits(subredditsToScan, 25);

    // Save results to DynamoDB
    await saveScanResults(results);

    // Calculate summary
    const summary = {
      scannedAt: new Date().toISOString(),
      subreddits: subredditsToScan,
      totalPosts: results.reduce((sum, r) => sum + r.stats.totalPosts, 0),
      totalComments: results.reduce((sum, r) => sum + r.stats.totalComments, 0),
      totalUniqueTickers: new Set(
        results.flatMap((r) => Array.from(r.tickers.keys()))
      ).size,
      totalMentions: results.reduce((sum, r) => sum + r.stats.totalMentions, 0),
    };

    logger.info('✅ Scan completed:', summary);

    return NextResponse.json({
      success: true,
      message: 'Scan completed and saved to database',
      data: summary,
    });
  } catch (error: unknown) {
    logger.error('❌ Automated scan error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Scan failed',
      },
      { status: 500 }
    );
  }
}
