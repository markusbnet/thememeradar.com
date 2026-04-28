import { NextRequest, NextResponse } from 'next/server';
import { authRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/test/reset-rate-limit
 * Resets the auth rate limiter and optionally sets a new max (for test isolation only)
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_ENDPOINTS && !process.env.CI) {
    return NextResponse.json({ success: false, error: 'Not allowed in production' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const max = typeof body.max === 'number' ? body.max : 1000;
  authRateLimiter.resetWithMax(max);

  return NextResponse.json({ success: true, max });
}
