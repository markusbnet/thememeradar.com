/**
 * Trending Stocks API Endpoint
 * GET /api/stocks/trending
 *
 * Returns top trending and fading stocks
 */

import { NextResponse } from 'next/server';
import { getTrendingStocks, getFadingStocks } from '@/lib/db/storage';

export async function GET() {
  try {
    // Fetch trending and fading stocks in parallel
    const [trending, fading] = await Promise.all([
      getTrendingStocks(10),
      getFadingStocks(10),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        trending,
        fading,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    console.error('Trending stocks API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch trending stocks',
      },
      { status: 500 }
    );
  }
}
