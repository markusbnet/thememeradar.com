import { logger } from '@/lib/logger';
/**
 * Stock Details API Endpoint
 * GET /api/stocks/[ticker]
 *
 * Returns detailed information about a specific stock
 */

import { NextResponse } from 'next/server';
import { getStockDetails, getStockEvidence, getStockHistory, getStockTimeBreakdown } from '@/lib/db/storage';
import { getLatestEnrichment } from '@/lib/db/enrichment';
import { getLatestPrice, getPriceHistory } from '@/lib/db/prices';
import { getLatestOptionsActivity } from '@/lib/market/swaggystocks';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Fetch stock details, evidence, history, time breakdown, enrichment, prices, and options in parallel
    const [details, evidence, history, timeBreakdown, enrichment, priceSnapshot, priceHistory, options] = await Promise.all([
      getStockDetails(ticker),
      getStockEvidence(ticker, 10),
      getStockHistory(ticker, 7),
      getStockTimeBreakdown(ticker),
      getLatestEnrichment(ticker),
      getLatestPrice(ticker),
      getPriceHistory(ticker, sevenDaysAgo, Date.now()),
      getLatestOptionsActivity(ticker),
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
        timeBreakdown,
        enrichment: enrichment ?? null,
        priceSnapshot: priceSnapshot ?? null,
        priceHistory: priceHistory.map(p => ({ timestamp: p.timestamp, price: p.price, volume: p.volume })),
        options: options ?? null,
        timestamp: Date.now(),
      },
    });
  } catch (error: unknown) {
    logger.error('Stock details API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stock details',
      },
      { status: 500 }
    );
  }
}
