/**
 * Historical Export API
 * GET /api/stocks/:ticker/export?format=csv|json&range=7d|30d
 *
 * Auth-gated. Returns 15-min mention buckets merged with price history.
 */

import { NextResponse } from 'next/server';
import { getStockDetails, getStockMentionRange } from '@/lib/db/storage';
import { getPriceHistory } from '@/lib/db/prices';
import { verifyToken } from '@/lib/auth/jwt';
import { generateExportCsv } from '@/lib/export/csv';
import type { ExportRow } from '@/lib/export/csv';
import type { StockPriceSnapshot } from '@/types/market';
import { logger } from '@/lib/logger';

const VALID_FORMATS = ['csv', 'json'] as const;
const VALID_RANGES  = ['7d', '30d'] as const;

const RANGE_MS: Record<string, number> = {
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function nearestPrice(
  ts: number,
  prices: StockPriceSnapshot[],
): StockPriceSnapshot | null {
  if (prices.length === 0) return null;
  let best = prices[0];
  let bestDiff = Math.abs(prices[0].timestamp - ts);
  for (let i = 1; i < prices.length; i++) {
    const diff = Math.abs(prices[i].timestamp - ts);
    if (diff < bestDiff) { best = prices[i]; bestDiff = diff; }
    if (prices[i].timestamp > ts) break; // sorted ascending, no point continuing
  }
  const ONE_HOUR_MS = 60 * 60 * 1000;
  return bestDiff <= ONE_HOUR_MS ? best : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
): Promise<Response> {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'meme_radar_session';
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
  const token = match?.[1] ?? '';

  if (!token || !verifyToken(token)) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawFormat = url.searchParams.get('format') ?? 'csv';
  const rawRange  = url.searchParams.get('range')  ?? '30d';

  if (!(VALID_FORMATS as readonly string[]).includes(rawFormat)) {
    return NextResponse.json(
      { success: false, error: `Invalid format "${rawFormat}". Valid values: ${VALID_FORMATS.join(', ')}` },
      { status: 400 },
    );
  }
  if (!(VALID_RANGES as readonly string[]).includes(rawRange)) {
    return NextResponse.json(
      { success: false, error: `Invalid range "${rawRange}". Valid values: ${VALID_RANGES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const { ticker: tickerParam } = await params;
    const ticker = tickerParam.toUpperCase();

    const now = Date.now();
    const fromMs = now - RANGE_MS[rawRange];

    const [details, mentions, prices] = await Promise.all([
      getStockDetails(ticker),
      getStockMentionRange(ticker, fromMs, now),
      getPriceHistory(ticker, fromMs, now),
    ]);

    if (!details) {
      return NextResponse.json({ success: false, error: 'Stock not found' }, { status: 404 });
    }

    const rows: ExportRow[] = mentions.map(m => {
      const p = nearestPrice(m.timestamp, prices);
      return {
        timestamp:         m.timestamp,
        date:              new Date(m.timestamp).toISOString(),
        mentionCount:      m.mentionCount,
        sentimentScore:    m.avgSentimentScore,
        sentimentCategory: m.sentimentCategory,
        price:             p?.price       ?? null,
        changePct24h:      p?.changePct24h ?? null,
        volume:            p?.volume       ?? null,
      };
    });

    if (rawFormat === 'json') {
      return NextResponse.json({ success: true, data: { ticker, range: rawRange, rows } });
    }

    const csv = generateExportCsv(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${ticker}-export-${rawRange}.csv"`,
        'Cache-Control':       'private, no-store',
      },
    });
  } catch (error: unknown) {
    logger.error('Export API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate export' },
      { status: 500 },
    );
  }
}
