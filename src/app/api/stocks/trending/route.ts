import { logger } from '@/lib/logger';
/**
 * Trending Stocks API Endpoint
 * GET /api/stocks/trending
 *
 * Returns top trending and fading stocks
 */

import { NextResponse } from 'next/server';
import { getTrendingStocks, getFadingStocks, getSparklineData } from '@/lib/db/storage';
import { getEnrichmentMap } from '@/lib/db/enrichment';
import { apiCache } from '@/lib/cache';

const CACHE_KEY = 'trending-fading';

export async function GET() {
  try {
    // Return cached response if available
    const cached = apiCache.get<{ trending: unknown[]; fading: unknown[]; timestamp: number }>(CACHE_KEY);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
      });
    }

    // Fetch trending and fading stocks in parallel
    const [trending, fading] = await Promise.all([
      getTrendingStocks(10),
      getFadingStocks(10),
    ]);

    // Fetch sparkline + enrichment data for all stocks in parallel
    const allTickers = [...trending, ...fading].map(s => s.ticker);
    const [sparklineResults, enrichmentMap] = await Promise.all([
      Promise.all(allTickers.map(ticker => getSparklineData(ticker, 7))),
      getEnrichmentMap(allTickers),
    ]);
    const sparklineMap = new Map<string, number[]>();
    allTickers.forEach((ticker, i) => sparklineMap.set(ticker, sparklineResults[i]));

    const addEnrichment = (stocks: typeof trending) =>
      stocks.map(stock => ({
        ...stock,
        sparklineData: sparklineMap.get(stock.ticker) || [],
        enrichment: enrichmentMap.get(stock.ticker) || null,
      }));

    const data = {
      trending: addEnrichment(trending),
      fading: addEnrichment(fading),
      timestamp: Date.now(),
    };

    // Cache for 5 minutes
    apiCache.set(CACHE_KEY, data);

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
