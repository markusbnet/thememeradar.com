/**
 * GET /api/internal/pending-alerts
 *
 * Returns pending (unsent) email alerts for Cowork to pick up and deliver
 * via Gmail MCP.
 *
 * Auth: Bearer ${ALERTS_API_SECRET}
 */

import { NextResponse } from 'next/server';
import { getPendingAlerts } from '@/lib/db/alerts';
import { logger } from '@/lib/logger';

function verifyAuth(request: Request): boolean {
  const secret = process.env.ALERTS_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const alerts = await getPendingAlerts();
    return NextResponse.json({ success: true, data: alerts });
  } catch (err: unknown) {
    logger.error('[Alerts] Error fetching pending alerts:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'DB error' },
      { status: 500 }
    );
  }
}
