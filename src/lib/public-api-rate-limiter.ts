import { RateLimiter } from './rate-limit';

export const publicRateLimiter = new RateLimiter({ maxAttempts: 60, windowMs: 60_000 });

export function getClientIP(request: Request): string {
  const forwarded = (request.headers as Headers).get('x-forwarded-for');
  const realIP = (request.headers as Headers).get('x-real-ip');
  return forwarded?.split(',')[0].trim() ?? realIP ?? 'unknown';
}
