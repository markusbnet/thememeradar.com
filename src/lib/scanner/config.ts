/**
 * Scanner listing-mix configuration.
 *
 * Rate-limit math (documented here per task spec):
 *
 * Hot:    7 subs × 25 posts = 175 post fetches.
 *         Comments only on posts with upvotes ≥ 10, avg ~10 per sub = 70 comment fetches.
 *
 * /new:   5 subs (WSB, stocks, pennystocks, Superstonk, options) × 30 posts = 150 post fetches.
 *         Comments only on posts with upvotes ≥ 5 AND containing a detected ticker
 *         = avg ~3 per sub = 15 comment fetches.
 *
 * /rising: 1 sub (WSB) × 25 posts = 25 post fetches.
 *         Comments on all rising posts (low count, high signal) = 25 comment fetches.
 *
 * Totals: post-listing entries = 350 (deduped to ~280 unique). Comment fetches = 110.
 * Grand total per scan ≈ 390 calls. At 5-min intervals = 78/min (under 100/min ceiling).
 * Budget cap: 500 calls per scan run.
 */

export const REDDIT_CALL_BUDGET = 500;

export type ListingType = 'hot' | 'new' | 'rising';

export interface ListingConfig {
  subreddits: string[] | 'all';
  limit: number;
  /** Sentiment weight multiplier for tickers found via this listing. */
  weight: number;
  /** Min post upvotes required to fetch comments. */
  commentThreshold: number;
}

export const LISTING_MIX: Record<ListingType, ListingConfig> = {
  hot: {
    subreddits: 'all',
    limit: 25,
    weight: 1.0,
    commentThreshold: 10,
  },
  new: {
    subreddits: ['wallstreetbets', 'stocks', 'pennystocks', 'Superstonk', 'options'],
    limit: 30,
    weight: 0.5,
    commentThreshold: 5,
  },
  rising: {
    subreddits: ['wallstreetbets'],
    limit: 25,
    weight: 1.5,
    commentThreshold: 0, // fetch comments for all rising posts (low count, high signal)
  },
};
