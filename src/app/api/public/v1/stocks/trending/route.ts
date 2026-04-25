/**
 * Public Trending Stocks API — v1
 * GET /api/public/v1/stocks/trending?timeframe=1h|4h|24h|7d&limit=N
 *
 * Unauthenticated, rate-limited at 60 req/min per IP.
 * Returns the same trending + fading data as the internal API, minus
 * per-user and DynamoDB-internal fields.
 */

import { NextResponse } from 'next/server';
import { getTrendingStocks, getFadingStocks, getSparklineData } from '@/lib/db/storage';
import type { Timeframe } from '@/lib/db/storage';
import { getEnrichmentMap } from '@/lib/db/enrichment';
import { getLatestPriceMap } from '@/lib/db/prices';
import { getLatestApewisdomSnapshot } from '@/lib/db/apewisdom';
import { mergeCoverage } from '@/lib/coverage/apewisdom';
import { apiCache } from '@/lib/cache';
import { publicRateLimiter, getClientIP } from '@/lib/public-api-rate-limiter';
import { logger } from '@/lib/logger';

const VALID_TIMEFRAMES = ['1h', '4h', '24h', '7d'] as const;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60',
};

function json(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  // Rate limiting (60 req/min per IP)
  const ip = getClientIP(request);
  const rl = publicRateLimiter.check(ip);
  if (!rl.allowed) {
    return json(
      { success: false, error: 'Rate limit exceeded. Max 60 requests/min.' },
      429,
    );
  }

  const url = new URL(request.url);
  const rawTimeframe = url.searchParams.get('timeframe') ?? '24h';

  if (!(VALID_TIMEFRAMES as readonly string[]).includes(rawTimeframe)) {
    return json(
      {
        success: false,
        error: `Invalid timeframe "${rawTimeframe}". Valid values: ${VALID_TIMEFRAMES.join(', ')}`,
      },
      400,
    );
  }

  const timeframe = rawTimeframe as Timeframe;
  const CACHE_KEY = `public-trending-${timeframe}`;

  try {
    const cached = apiCache.get<unknown>(CACHE_KEY);
    if (cached) {
      return json({ success: true, data: cached });
    }

    const [trendingRaw, fadingRaw, awSnapshot] = await Promise.all([
      getTrendingStocks(10, timeframe),
      getFadingStocks(10, timeframe),
      getLatestApewisdomSnapshot('wallstreetbets'),
    ]);

    const now = Date.now();
    const trending = mergeCoverage(trendingRaw, awSnapshot, now);
    const fading   = mergeCoverage(fadingRaw,   awSnapshot, now);

    const allTickers = [...trending, ...fading].map(s => s.ticker);
    const [sparklineResults, enrichmentMap, priceMap] = await Promise.all([
      Promise.all(allTickers.map(ticker => getSparklineData(ticker, 7))),
      getEnrichmentMap(allTickers),
      getLatestPriceMap(allTickers),
    ]);
    const sparklineMap = new Map<string, number[]>();
    allTickers.forEach((ticker, i) => sparklineMap.set(ticker, sparklineResults[i]));

    const toPublicStock = (stocks: typeof trending) =>
      stocks.map(({ ticker, mentionCount, mentionsPrev, mentionDelta, sentimentScore,
                    sentimentCategory, velocity, rankDelta24h, rankStatus, coverageSource }) => ({
        ticker,
        mentionCount,
        mentionsPrev:    mentionsPrev    ?? null,
        mentionDelta:    mentionDelta    ?? null,
        sentimentScore,
        sentimentCategory,
        velocity,
        rankDelta24h:    rankDelta24h    ?? null,
        rankStatus:      rankStatus      ?? 'unknown',
        coverageSource:  coverageSource  ?? 'reddit',
        sparklineData:   sparklineMap.get(ticker) ?? [],
        enrichment:      enrichmentMap.get(ticker) ?? null,
        price:           priceMap.get(ticker) ?? null,
      }));

    const data = {
      trending:  toPublicStock(trending),
      fading:    toPublicStock(fading),
      timeframe,
      timestamp: now,
    };

    apiCache.set(CACHE_KEY, data);
    return json({ success: true, data });
  } catch (error: unknown) {
    logger.error('Public trending API error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch trending stocks' },
      500,
    );
  }
}
