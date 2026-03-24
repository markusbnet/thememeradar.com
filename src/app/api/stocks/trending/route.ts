import { logger } from '@/lib/logger';
/**
 * Trending Stocks API Endpoint
 * GET /api/stocks/trending
 *
 * Returns top trending and fading stocks
 */

import { NextResponse } from 'next/server';
import { getTrendingStocks, getFadingStocks, getSparklineData } from '@/lib/db/storage';

export async function GET() {
  try {
    // Fetch trending and fading stocks in parallel
    const [trending, fading] = await Promise.all([
      getTrendingStocks(10),
      getFadingStocks(10),
    ]);

    // Fetch sparkline data for all stocks in parallel
    const allTickers = [...trending, ...fading].map(s => s.ticker);
    const sparklineResults = await Promise.all(
      allTickers.map(ticker => getSparklineData(ticker, 7))
    );
    const sparklineMap = new Map<string, number[]>();
    allTickers.forEach((ticker, i) => sparklineMap.set(ticker, sparklineResults[i]));

    const addSparkline = (stocks: typeof trending) =>
      stocks.map(stock => ({
        ...stock,
        sparklineData: sparklineMap.get(stock.ticker) || [],
      }));

    return NextResponse.json({
      success: true,
      data: {
        trending: addSparkline(trending),
        fading: addSparkline(fading),
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    logger.error('Trending stocks API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch trending stocks',
      },
      { status: 500 }
    );
  }
}
