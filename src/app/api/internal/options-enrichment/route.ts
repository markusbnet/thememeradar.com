import { NextRequest, NextResponse } from 'next/server';
import { docClient, TABLES, PutCommand } from '@/lib/db/client';
import type { OptionsActivity, OptionsIngestPayload } from '@/types/options';
import { logger } from '@/lib/logger';

function verifyAuth(request: NextRequest | Request): boolean {
  const secret = process.env.OPTIONS_INGEST_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

function validateRow(row: unknown): row is Omit<OptionsActivity, 'ttl'> {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.ticker === 'string' && r.ticker.length > 0 &&
    typeof r.timestamp === 'number' &&
    typeof r.callOpenInterest === 'number' &&
    typeof r.putOpenInterest === 'number' &&
    typeof r.putCallRatio === 'number' &&
    (r.iv30d === null || typeof r.iv30d === 'number') &&
    typeof r.fetchedAt === 'number'
  );
}

export async function POST(request: NextRequest | Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as Record<string, unknown>).rows)
  ) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid "rows" array' },
      { status: 400 }
    );
  }

  const payload = body as OptionsIngestPayload;

  if (payload.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'rows array must not be empty' },
      { status: 400 }
    );
  }

  const invalidRows = payload.rows.filter((r) => !validateRow(r));
  if (invalidRows.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid row data' },
      { status: 400 }
    );
  }

  try {
    const TTL_30D = 30 * 24 * 60 * 60;
    await Promise.all(
      payload.rows.map((row) =>
        docClient.send(
          new PutCommand({
            TableName: TABLES.STOCK_OPTIONS,
            Item: {
              ...row,
              ticker: row.ticker.toUpperCase(),
              ttl: Math.floor(row.fetchedAt / 1000) + TTL_30D,
            },
          })
        )
      )
    );

    return NextResponse.json(
      { success: true, data: { count: payload.rows.length } },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('Options ingest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save options data',
      },
      { status: 500 }
    );
  }
}
