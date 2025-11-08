/**
 * Rate Limiting Middleware
 * Applies rate limiting to authentication endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from './rate-limiter';

/**
 * Extract IP address from request
 * Uses X-Forwarded-For header (set by Vercel) or fallback to socket
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, use the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to a default (shouldn't happen in production with Vercel)
  return 'unknown';
}

/**
 * Check rate limit for authentication requests
 * Returns 429 error response if rate limit exceeded
 *
 * @param request Next.js request object
 * @param identifier Additional identifier (e.g., email) to combine with IP
 * @returns NextResponse with 429 status if rate limited, null otherwise
 */
export function checkRateLimit(
  request: NextRequest,
  identifier?: string
): NextResponse | null {
  const ip = getClientIP(request);
  const key = identifier ? `${ip}:${identifier}` : ip;

  // Check if rate limited
  if (rateLimiter.isRateLimited(key)) {
    const resetTime = rateLimiter.getResetTime(key);
    const resetMinutes = Math.ceil(resetTime / 60000);

    return NextResponse.json(
      {
        success: false,
        error: `Too many attempts. Please try again in ${resetMinutes} minute${
          resetMinutes !== 1 ? 's' : ''
        }.`,
        retryAfter: resetTime,
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil(resetTime / 1000).toString(),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + resetTime).toString(),
        },
      }
    );
  }

  // Record this attempt
  rateLimiter.recordAttempt(key);

  // Include rate limit info in headers
  const remaining = rateLimiter.getRemainingAttempts(key);

  return null; // Not rate limited - continue processing
}

/**
 * Reset rate limit for a key (call after successful authentication)
 * @param request Next.js request object
 * @param identifier Additional identifier (e.g., email)
 */
export function resetRateLimit(request: NextRequest, identifier?: string): void {
  const ip = getClientIP(request);
  const key = identifier ? `${ip}:${identifier}` : ip;
  rateLimiter.reset(key);
}

/**
 * Get rate limit headers to include in successful responses
 * @param request Next.js request object
 * @param identifier Additional identifier
 */
export function getRateLimitHeaders(
  request: NextRequest,
  identifier?: string
): Record<string, string> {
  const ip = getClientIP(request);
  const key = identifier ? `${ip}:${identifier}` : ip;
  const remaining = rateLimiter.getRemainingAttempts(key);

  return {
    'X-RateLimit-Limit': '5',
    'X-RateLimit-Remaining': remaining.toString(),
  };
}
