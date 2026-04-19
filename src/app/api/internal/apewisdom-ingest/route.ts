import { NextResponse } from 'next/server';
import { parseApewisdomPayload } from '@/lib/coverage/apewisdom';
import { saveApewisdomSnapshot } from '@/lib/db/apewisdom';
import { logger } from '@/lib/logger';

function verifyAuth(request: Request): boolean {
  const secret = process.env.APEWISDOM_INGEST_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  let snapshot;
  try {
    snapshot = parseApewisdomPayload(body as any);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    );
  }

  try {
    await saveApewisdomSnapshot(snapshot);
    logger.info(`[ApeWisdom] Ingested ${snapshot.rows.length} rows for r/${snapshot.subreddit}`);
    return NextResponse.json({ success: true, rowCount: snapshot.rows.length });
  } catch (err: unknown) {
    logger.error('[ApeWisdom] Ingest DB error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'DB write failed' },
      { status: 500 }
    );
  }
}
