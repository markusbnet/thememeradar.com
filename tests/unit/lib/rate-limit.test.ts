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

  it('should clean up expired entries when store exceeds 100 keys', () => {
    const shortLimiter = new RateLimiter({ maxAttempts: 5, windowMs: 50 });

    // Add 101 entries to trigger cleanup threshold
    for (let i = 0; i < 101; i++) {
      shortLimiter.check(`ip-${i}`);
    }
    expect(shortLimiter.size).toBe(101);

    // Wait for window to expire, then trigger a new check to trigger cleanup
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        shortLimiter.check('new-ip');
        // All 101 expired entries should have been cleaned up, leaving only 'new-ip'
        expect(shortLimiter.size).toBe(1);
        resolve();
      }, 100);
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

  it('should clear all entries when reset() is called', () => {
    // Populate the limiter with entries
    limiter.check('10.0.0.1');
    limiter.check('10.0.0.2');
    limiter.check('10.0.0.3');
    expect(limiter.size).toBe(3);

    limiter.reset();

    expect(limiter.size).toBe(0);

    // After reset, previously-tracked IPs get a fresh window
    const result = limiter.check('10.0.0.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe('authRateLimiter env configuration', () => {
  const ORIGINAL_ENV = process.env.AUTH_RATE_LIMIT_MAX;

  afterEach(() => {
    // Restore original env and flush module cache so the singleton re-reads it
    if (ORIGINAL_ENV === undefined) {
      delete process.env.AUTH_RATE_LIMIT_MAX;
    } else {
      process.env.AUTH_RATE_LIMIT_MAX = ORIGINAL_ENV;
    }
    jest.resetModules();
  });

  it('should default to 5 max attempts when AUTH_RATE_LIMIT_MAX is unset', async () => {
    delete process.env.AUTH_RATE_LIMIT_MAX;
    jest.resetModules();
    const { authRateLimiter } = await import('@/lib/rate-limit');

    // 5 requests allowed, 6th blocked
    for (let i = 0; i < 5; i++) {
      expect(authRateLimiter.check('env-test-1').allowed).toBe(true);
    }
    expect(authRateLimiter.check('env-test-1').allowed).toBe(false);
  });

  it('should respect AUTH_RATE_LIMIT_MAX env var when set', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    jest.resetModules();
    const { authRateLimiter } = await import('@/lib/rate-limit');

    // Only 3 requests allowed, 4th blocked
    for (let i = 0; i < 3; i++) {
      expect(authRateLimiter.check('env-test-2').allowed).toBe(true);
    }
    expect(authRateLimiter.check('env-test-2').allowed).toBe(false);
  });
});
