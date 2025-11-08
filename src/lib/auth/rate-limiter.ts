/**
 * Rate Limiter
 * Implements in-memory rate limiting for authentication endpoints
 * CLAUDE.md requirement: 5 attempts per 15 minutes
 */

interface RateLimitEntry {
  attempts: number[];
  firstAttempt: number;
}

class RateLimiter {
  private storage: Map<string, RateLimitEntry>;
  private maxAttempts: number;
  private windowMs: number;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.storage = new Map();
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.cleanupInterval = null;

    // Start cleanup interval to remove old entries
    this.startCleanup();
  }

  /**
   * Check if a key has exceeded the rate limit
   * @param key Unique identifier (e.g., IP + email)
   * @returns true if rate limit exceeded, false otherwise
   */
  isRateLimited(key: string): boolean {
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry) {
      return false;
    }

    // Filter out attempts outside the window
    const recentAttempts = entry.attempts.filter(
      timestamp => now - timestamp < this.windowMs
    );

    return recentAttempts.length >= this.maxAttempts;
  }

  /**
   * Record an attempt for a key
   * @param key Unique identifier (e.g., IP + email)
   */
  recordAttempt(key: string): void {
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry) {
      this.storage.set(key, {
        attempts: [now],
        firstAttempt: now,
      });
      return;
    }

    // Filter out old attempts and add new one
    const recentAttempts = entry.attempts.filter(
      timestamp => now - timestamp < this.windowMs
    );
    recentAttempts.push(now);

    this.storage.set(key, {
      attempts: recentAttempts,
      firstAttempt: entry.firstAttempt,
    });
  }

  /**
   * Get remaining attempts for a key
   * @param key Unique identifier
   * @returns Number of remaining attempts before rate limit
   */
  getRemainingAttempts(key: string): number {
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry) {
      return this.maxAttempts;
    }

    const recentAttempts = entry.attempts.filter(
      timestamp => now - timestamp < this.windowMs
    );

    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  /**
   * Get time until rate limit resets (in ms)
   * @param key Unique identifier
   * @returns Milliseconds until oldest attempt expires, or 0 if not rate limited
   */
  getResetTime(key: string): number {
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry || entry.attempts.length === 0) {
      return 0;
    }

    const oldestAttempt = Math.min(...entry.attempts);
    const resetTime = oldestAttempt + this.windowMs - now;

    return Math.max(0, resetTime);
  }

  /**
   * Reset rate limit for a key (e.g., after successful login)
   * @param key Unique identifier
   */
  reset(key: string): void {
    this.storage.delete(key);
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Remove entries older than the window
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.storage.entries()) {
      const recentAttempts = entry.attempts.filter(
        timestamp => now - timestamp < this.windowMs
      );

      if (recentAttempts.length === 0) {
        this.storage.delete(key);
      } else {
        this.storage.set(key, {
          attempts: recentAttempts,
          firstAttempt: entry.firstAttempt,
        });
      }
    }
  }

  /**
   * Stop cleanup interval (for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Get current storage size (for monitoring)
   */
  getSize(): number {
    return this.storage.size;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(5, 15 * 60 * 1000);

// Export class for testing
export { RateLimiter };
