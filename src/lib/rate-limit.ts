interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  reset(): void {
    this.store.clear();
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.config.maxAttempts - 1 };
    }

    if (entry.count >= this.config.maxAttempts) {
      const retryAfterMs = this.config.windowMs - (now - entry.windowStart);
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    entry.count++;
    return { allowed: true, remaining: this.config.maxAttempts - entry.count };
  }
}

export const authRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
});
