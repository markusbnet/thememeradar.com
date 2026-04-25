/**
 * Public Stock Detail API — v1
 * GET /api/public/v1/stocks/:ticker
 *
 * Unauthenticated, rate-limited at 60 req/min per IP.
 */

import { NextResponse } from 'next/server';
import { getStockDetails, getStockEvidence, getStockHistory, getStockTimeBreakdown } from '@/lib/db/storage';
import { getLatestEnrichment } from '@/lib/db/enrichment';
import { getLatestPrice, getPriceHistory } from '@/lib/db/prices';
import { getLatestOptionsActivity } from '@/lib/market/swaggystocks';
import { publicRateLimiter, getClientIP } from '@/lib/public-api-rate-limiter';
import { logger } from '@/lib/logger';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60',
};

function json(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
): Promise<Response> {
  const ip = getClientIP(request);
  const rl = publicRateLimiter.check(ip);
  if (!rl.allowed) {
    return json({ success: false, error: 'Rate limit exceeded. Max 60 requests/min.' }, 429);
  }

  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const [details, evidence, history, timeBreakdown, enrichment, priceSnapshot, priceHistory, options] =
      await Promise.all([
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
      return json({ success: false, error: 'Stock not found' }, 404);
    }

    return json({
      success: true,
      data: {
        ticker,
        details: {
          mentionCount:      details.mentionCount,
          sentimentScore:    details.sentimentScore,
          sentimentCategory: details.sentimentCategory,
          velocity:          details.velocity,
        },
        evidence,
        history,
        timeBreakdown,
        enrichment:   enrichment   ?? null,
        priceSnapshot: priceSnapshot ?? null,
        priceHistory: priceHistory.map(p => ({ timestamp: p.timestamp, price: p.price, volume: p.volume })),
        options:      options       ?? null,
        timestamp:    Date.now(),
      },
    });
  } catch (error: unknown) {
    logger.error('Public stock detail API error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch stock details' },
      500,
    );
  }
}
