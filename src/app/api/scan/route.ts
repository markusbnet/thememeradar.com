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
import { enrichWithLunarCrush } from '@/lib/lunarcrush';
import { enrichWithPrices } from '@/lib/market/finnhub';
import { parseSubredditList } from '@/lib/scan-config';
import { checkAndCreateAlerts } from '@/lib/alert-pipeline';

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

    // Enrich top tickers with LunarCrush data (no-op if LUNARCRUSH_API_KEY is absent)
    const allTickers = [...new Set(results.flatMap(r => Array.from(r.tickers.keys())))];
    enrichWithLunarCrush(allTickers).catch((err: unknown) =>
      logger.error('LunarCrush enrichment error:', err)
    );

    // Enrich top 50 tickers with Finnhub price data (no-op if FINNHUB_API_KEY is absent)
    const topTickers = allTickers.slice(0, 50);
    enrichWithPrices(topTickers).catch((err: unknown) =>
      logger.error('Finnhub price enrichment error:', err)
    );

    // Check for hot opportunities and generate email alerts (fire-and-forget)
    checkAndCreateAlerts(allTickers).catch((err: unknown) =>
      logger.error('Alert generation error:', err)
    );

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
