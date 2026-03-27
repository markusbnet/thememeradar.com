/**
 * Surging Stocks API Endpoint
 * GET /api/stocks/surging
 *
 * Returns stocks with unusual mention velocity spikes (3x+ baseline)
 */

import { NextResponse } from 'next/server';
import { getSurgingStocks } from '@/lib/db/surge';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10) || 5, 10);

    const surging = await getSurgingStocks(limit);

    return NextResponse.json({
      success: true,
      data: {
        surging,
        timestamp: Date.now(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch surging stocks';
    logger.error('Surging stocks API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
