import { logger } from '@/lib/logger';
/**
 * Reddit Scan API Endpoint
 * GET  /api/scan - Automated cron job (scans default subreddits)
 * POST /api/scan - Manual scan (custom subreddits)
 *
 * Scans Reddit for stock mentions, analyzes sentiment, and saves to DynamoDB
 *
 * Reliability controls (GET path):
 *   - Mutex lock prevents overlapping Vercel Cron invocations.
 *   - Heartbeat row tracks started/success/failed status for health endpoint.
 *   - Failure alert emits operator notification (with cooldown).
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createScanner } from '@/lib/scanner/scanner';
import { saveScanResults } from '@/lib/db/storage';
import { enrichWithLunarCrush } from '@/lib/lunarcrush';
import { enrichWithPrices } from '@/lib/market/finnhub';
import { parseSubredditList } from '@/lib/scan-config';
import { checkAndCreateAlerts } from '@/lib/alert-pipeline';
import { acquireScanLock, releaseScanLock } from '@/lib/db/scan-lock';
import {
  recordScanStarted,
  recordScanSuccess,
  recordScanFailed,
} from '@/lib/db/scan-heartbeat';
import { recordScanFailureAlert } from '@/lib/scan-failure-alert';

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

  // Validate Reddit credentials before taking the lock — no point locking out
  // the next cron tick over a config error.
  if (!REDDIT_CONFIG.clientId || !REDDIT_CONFIG.clientSecret) {
    return NextResponse.json(
      {
        success: false,
        error: 'Reddit API credentials not configured',
      },
      { status: 500 }
    );
  }

  const runId = randomUUID();
  const lock = await acquireScanLock({ holder: runId });
  if (!lock.acquired) {
    logger.info(`⏭  Skipping scan: another run holds the lock (runId=${runId})`);
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        reason: 'another scan is in progress',
      },
      { status: 200 }
    );
  }

  const startedAt = Date.now();
  await recordScanStarted({ runId, now: startedAt });

  try {
    const subredditsToScan = parseSubredditList(process.env.SCAN_SUBREDDITS);

    logger.info(`🔄 Starting Reddit scan (runId=${runId})`);
    logger.info(`📡 Scanning subreddits: ${subredditsToScan.join(', ')}`);

    const scanner = createScanner(REDDIT_CONFIG);
    const results = await scanner.scanMultipleSubreddits(subredditsToScan, 25);
    await saveScanResults(results);

    const allTickers = [...new Set(results.flatMap(r => Array.from(r.tickers.keys())))];
    enrichWithLunarCrush(allTickers).catch((err: unknown) =>
      logger.error('LunarCrush enrichment error:', err)
    );

    const topTickers = allTickers.slice(0, 50);
    enrichWithPrices(topTickers).catch((err: unknown) =>
      logger.error('Finnhub price enrichment error:', err)
    );

    checkAndCreateAlerts(allTickers).catch((err: unknown) =>
      logger.error('Alert generation error:', err)
    );

    const summary = {
      scannedAt: new Date().toISOString(),
      subreddits: subredditsToScan,
      totalPosts: results.reduce((sum, r) => sum + r.stats.totalPosts, 0),
      totalComments: results.reduce((sum, r) => sum + r.stats.totalComments, 0),
      totalUniqueTickers: allTickers.length,
      totalMentions: results.reduce((sum, r) => sum + r.stats.totalMentions, 0),
    };

    await recordScanSuccess({
      runId,
      startedAt,
      summary: {
        totalPosts: summary.totalPosts,
        totalComments: summary.totalComments,
        totalMentions: summary.totalMentions,
        totalUniqueTickers: summary.totalUniqueTickers,
        subreddits: summary.subreddits,
      },
    });

    logger.info('✅ Scan completed:', summary);

    return NextResponse.json({
      success: true,
      message: 'Scan completed and saved to database',
      data: summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scan failed';
    logger.error('❌ Automated scan error:', error);

    // Best-effort: record failure on heartbeat + write operator alert. Both
    // swallow their own errors so the client still gets a 500 from the scan.
    await recordScanFailed({ runId, startedAt, errorMessage: message }).catch(
      err => logger.error('Failed to record scan-failed heartbeat:', err)
    );
    await recordScanFailureAlert({ runId, errorMessage: message }).catch(err =>
      logger.error('Failed to write scan-failure alert:', err)
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  } finally {
    // Release the lock even if the response encoding threw — lockup on a
    // process crash is bounded by the lock's TTL (10 min by default).
    await releaseScanLock({ holder: runId }).catch(err =>
      logger.error('Failed to release scan lock:', err)
    );
  }
}
