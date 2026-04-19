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

  get size(): number {
    return this.store.size;
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart >= this.config.windowMs) {
        this.store.delete(key);
      }
    }
  }

  check(key: string): RateLimitResult {
    const now = Date.now();

    // Sweep expired entries when store grows to prevent unbounded memory usage
    if (this.store.size > 100) {
      this.cleanup(now);
    }

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

/**
 * Per-scan-run Reddit API call budget.
 * Prevents any single scan from exceeding the Reddit API rate limit.
 */
export class RedditCallBudget {
  private used = 0;
  private readonly budget: number;

  constructor(budget: number) {
    this.budget = budget;
  }

  canMakeCall(): boolean {
    return this.used < this.budget;
  }

  recordCall(): void {
    this.used++;
  }

  get callsUsed(): number {
    return this.used;
  }

  get remaining(): number {
    return Math.max(0, this.budget - this.used);
  }

  reset(): void {
    this.used = 0;
  }
}

export const authRateLimiter = new RateLimiter({
  maxAttempts: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) : 5,
  windowMs: 15 * 60 * 1000,
});
