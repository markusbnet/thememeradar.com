import { logger } from '@/lib/logger';
/**
 * Stock Details API Endpoint
 * GET /api/stocks/[ticker]
 *
 * Returns detailed information about a specific stock
 */

import { NextResponse } from 'next/server';
import { getStockDetails, getStockEvidence, getStockHistory } from '@/lib/db/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    // Fetch stock details, evidence, and history in parallel
    const [details, evidence, history] = await Promise.all([
      getStockDetails(ticker),
      getStockEvidence(ticker, 10),
      getStockHistory(ticker, 7),
    ]);

    if (!details) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stock not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ticker,
        details,
        evidence,
        history,
        timestamp: Date.now(),
      },
    });
  } catch (error: any) {
    logger.error('Stock details API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch stock details',
      },
      { status: 500 }
    );
  }
}
