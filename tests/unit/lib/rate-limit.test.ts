import { RateLimiter } from '@/lib/rate-limit';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });
  });

  it('should allow requests under the limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('192.168.1.1')).toEqual({ allowed: true, remaining: 5 - i - 1 });
    }
  });

  it('should block the 6th request within the window', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('192.168.1.1');
    }

    const result = limiter.check('192.168.1.1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should track IPs independently', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('192.168.1.1');
    }

    // Different IP should still be allowed
    const result = limiter.check('192.168.1.2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should reset after the window expires', () => {
    const shortLimiter = new RateLimiter({ maxAttempts: 2, windowMs: 100 });
    shortLimiter.check('10.0.0.1');
    shortLimiter.check('10.0.0.1');

    // Should be blocked
    expect(shortLimiter.check('10.0.0.1').allowed).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = shortLimiter.check('10.0.0.1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
        resolve();
      }, 150);
    });
  });

  it('should return retryAfterMs when blocked', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('10.0.0.1');
    }

    const result = limiter.check('10.0.0.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs!).toBeGreaterThan(0);
    expect(result.retryAfterMs!).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});
