/**
 * Unit Tests for Rate Limiter
 */

import { RateLimiter } from '@/lib/auth/rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // Create new limiter with default settings (5 attempts, 15min window)
    limiter = new RateLimiter(5, 15 * 60 * 1000);
  });

  afterEach(() => {
    limiter.stopCleanup();
    limiter.clear();
  });

  describe('isRateLimited', () => {
    it('should return false for first attempt', () => {
      expect(limiter.isRateLimited('test-key')).toBe(false);
    });

    it('should return false when under limit', () => {
      limiter.recordAttempt('test-key');
      limiter.recordAttempt('test-key');
      limiter.recordAttempt('test-key');

      expect(limiter.isRateLimited('test-key')).toBe(false);
    });

    it('should return true when limit reached', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordAttempt('test-key');
      }

      expect(limiter.isRateLimited('test-key')).toBe(true);
    });

    it('should track different keys independently', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordAttempt('key1');
      }

      expect(limiter.isRateLimited('key1')).toBe(true);
      expect(limiter.isRateLimited('key2')).toBe(false);
    });
  });

  describe('recordAttempt', () => {
    it('should record single attempt', () => {
      limiter.recordAttempt('test-key');
      expect(limiter.getRemainingAttempts('test-key')).toBe(4);
    });

    it('should record multiple attempts', () => {
      limiter.recordAttempt('test-key');
      limiter.recordAttempt('test-key');
      limiter.recordAttempt('test-key');

      expect(limiter.getRemainingAttempts('test-key')).toBe(2);
    });
  });

  describe('getRemainingAttempts', () => {
    it('should return max attempts for new key', () => {
      expect(limiter.getRemainingAttempts('new-key')).toBe(5);
    });

    it('should return correct remaining attempts', () => {
      limiter.recordAttempt('test-key');
      limiter.recordAttempt('test-key');

      expect(limiter.getRemainingAttempts('test-key')).toBe(3);
    });

    it('should return 0 when limit reached', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordAttempt('test-key');
      }

      expect(limiter.getRemainingAttempts('test-key')).toBe(0);
    });

    it('should return 0 when limit exceeded', () => {
      for (let i = 0; i < 10; i++) {
        limiter.recordAttempt('test-key');
      }

      expect(limiter.getRemainingAttempts('test-key')).toBe(0);
    });
  });

  describe('getResetTime', () => {
    it('should return 0 for new key', () => {
      expect(limiter.getResetTime('new-key')).toBe(0);
    });

    it('should return time until reset', () => {
      limiter.recordAttempt('test-key');
      const resetTime = limiter.getResetTime('test-key');

      // Should be close to 15 minutes (in ms)
      expect(resetTime).toBeGreaterThan(14 * 60 * 1000);
      expect(resetTime).toBeLessThanOrEqual(15 * 60 * 1000);
    });

    it('should decrease reset time over time', async () => {
      limiter.recordAttempt('test-key');
      const resetTime1 = limiter.getResetTime('test-key');

      // Wait 100ms
      await new Promise(resolve => setTimeout(resolve, 100));

      const resetTime2 = limiter.getResetTime('test-key');
      expect(resetTime2).toBeLessThan(resetTime1);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for key', () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordAttempt('test-key');
      }

      expect(limiter.isRateLimited('test-key')).toBe(true);

      limiter.reset('test-key');

      expect(limiter.isRateLimited('test-key')).toBe(false);
      expect(limiter.getRemainingAttempts('test-key')).toBe(5);
    });

    it('should not affect other keys', () => {
      limiter.recordAttempt('key1');
      limiter.recordAttempt('key2');

      limiter.reset('key1');

      expect(limiter.getRemainingAttempts('key1')).toBe(5);
      expect(limiter.getRemainingAttempts('key2')).toBe(4);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      // Create limiter with short window for testing
      const shortLimiter = new RateLimiter(5, 100); // 100ms window

      shortLimiter.recordAttempt('test-key');
      expect(shortLimiter.getSize()).toBe(1);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Manually trigger cleanup (normally runs every 5 min)
      shortLimiter['cleanup']();

      expect(shortLimiter.getSize()).toBe(0);

      shortLimiter.stopCleanup();
    });

    it('should keep recent entries', async () => {
      const shortLimiter = new RateLimiter(5, 500); // 500ms window

      shortLimiter.recordAttempt('test-key');

      // Wait a bit but not past window
      await new Promise(resolve => setTimeout(resolve, 100));

      shortLimiter['cleanup']();

      expect(shortLimiter.getSize()).toBe(1);

      shortLimiter.stopCleanup();
    });
  });

  describe('custom limits', () => {
    it('should respect custom max attempts', () => {
      const customLimiter = new RateLimiter(3, 15 * 60 * 1000);

      customLimiter.recordAttempt('test-key');
      customLimiter.recordAttempt('test-key');

      expect(customLimiter.isRateLimited('test-key')).toBe(false);

      customLimiter.recordAttempt('test-key');

      expect(customLimiter.isRateLimited('test-key')).toBe(true);

      customLimiter.stopCleanup();
    });

    it('should respect custom window size', async () => {
      const customLimiter = new RateLimiter(5, 200); // 200ms window

      for (let i = 0; i < 5; i++) {
        customLimiter.recordAttempt('test-key');
      }

      expect(customLimiter.isRateLimited('test-key')).toBe(true);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should not be rate limited anymore (old attempts expired)
      expect(customLimiter.isRateLimited('test-key')).toBe(false);

      customLimiter.stopCleanup();
    });
  });
});
