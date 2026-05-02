import { logger } from '@/lib/logger';
/**
 * Trending Stocks API Endpoint
 * GET /api/stocks/trending?timeframe=1h|4h|24h|7d
 *
 * Returns top trending and fading stocks for the given timeframe.
 * Defaults to 24h when ?timeframe is omitted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrendingStocks, getFadingStocks, getSparklineData } from '@/lib/db/storage';
import type { Timeframe } from '@/lib/db/storage';
import { getEnrichmentMap } from '@/lib/db/enrichment';
import { getLatestPriceMap } from '@/lib/db/prices';
import { getLatestApewisdomSnapshot } from '@/lib/db/apewisdom';
import { mergeCoverage } from '@/lib/coverage/apewisdom';
import { apiCache } from '@/lib/cache';

const VALID_TIMEFRAMES = ['1h', '4h', '24h', '7d'] as const;

export async function GET(request: NextRequest) {
  const rawTimeframe = new URL(request.url).searchParams.get('timeframe') ?? '24h';

  if (!(VALID_TIMEFRAMES as readonly string[]).includes(rawTimeframe)) {
    return NextResponse.json(
      { success: false, error: `Invalid timeframe "${rawTimeframe}". Valid values: ${VALID_TIMEFRAMES.join(', ')}` },
      { status: 400 }
    );
  }

  const timeframe = rawTimeframe as Timeframe;
  const CACHE_KEY = `trending-fading-${timeframe}`;

  try {
    // Return cached response if available (skipped during E2E runs to prevent
    // race conditions between parallel Playwright workers seeding different tickers).
    // E2E_TEST_MODE is set by the playwright webServer env only — not by the
    // global CI environment — so integration-test cache-behavior tests still work.
    const cached = process.env.E2E_TEST_MODE
      ? null
      : apiCache.get<{ trending: unknown[]; fading: unknown[]; timestamp: number }>(CACHE_KEY);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
      });
    }

    // Fetch trending and fading stocks plus ApeWisdom snapshot in parallel
    const [trendingRaw, fadingRaw, awSnapshot] = await Promise.all([
      getTrendingStocks(10, timeframe),
      getFadingStocks(10, timeframe),
      getLatestApewisdomSnapshot('all-stocks'),
    ]);

    const now = Date.now();
    const trending = mergeCoverage(trendingRaw, awSnapshot, now);
    const fading = mergeCoverage(fadingRaw, awSnapshot, now);

    // Fetch sparkline + enrichment + price data for all stocks in parallel
    const allTickers = [...trending, ...fading].map(s => s.ticker);
    const [sparklineResults, enrichmentMap, priceMap] = await Promise.all([
      Promise.all(allTickers.map(ticker => getSparklineData(ticker, 7))),
      getEnrichmentMap(allTickers),
      getLatestPriceMap(allTickers),
    ]);
    const sparklineMap = new Map<string, number[]>();
    allTickers.forEach((ticker, i) => sparklineMap.set(ticker, sparklineResults[i]));

    const addEnrichment = (stocks: typeof trending) =>
      stocks.map(stock => ({
        ...stock,
        sparklineData: sparklineMap.get(stock.ticker) || [],
        enrichment: enrichmentMap.get(stock.ticker) || null,
        price: priceMap.get(stock.ticker) || null,
      }));

    const data = {
      trending: addEnrichment(trending),
      fading: addEnrichment(fading),
      timestamp: now,
    };

    // Cache for 5 minutes (skipped in E2E mode — see read comment above)
    if (!process.env.E2E_TEST_MODE) apiCache.set(CACHE_KEY, data);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    logger.error('Trending stocks API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trending stocks',
      },
      { status: 500 }
    );
  }
}
