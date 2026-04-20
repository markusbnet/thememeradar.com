/**
 * POST /api/internal/pending-alerts/[ticker]/sent
 *
 * Marks an alert as delivered after Cowork has sent it via Gmail MCP.
 *
 * Request body: { createdAt: number }
 *
 * Auth: Bearer ${ALERTS_API_SECRET}
 */

import { NextResponse } from 'next/server';
import { markAlertSent } from '@/lib/db/alerts';
import { logger } from '@/lib/logger';

function verifyAuth(request: Request): boolean {
  const secret = process.env.ALERTS_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
): Promise<NextResponse> {
  if (!verifyAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = body as Record<string, unknown>;
  if (typeof parsed.createdAt !== 'number') {
    return NextResponse.json(
      { success: false, error: 'createdAt (number) is required' },
      { status: 400 }
    );
  }

  const { ticker } = await params;
  const { createdAt } = parsed;

  try {
    const updated = await markAlertSent(ticker, createdAt);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }
    logger.info(`[Alerts] Marked alert as sent: ${ticker} createdAt=${createdAt}`);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    logger.error('[Alerts] Error marking alert as sent:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
