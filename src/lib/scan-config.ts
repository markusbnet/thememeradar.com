/**
 * Scan configuration helpers.
 * Separated from the route file so utilities can be unit-tested without
 * triggering Next.js's route-export validation.
 */

const DEFAULT_SUBREDDITS = [
  'wallstreetbets', 'stocks', 'investing',
  'pennystocks', 'Superstonk', 'StockMarket', 'options',
];

/**
 * Parse the SCAN_SUBREDDITS env var (comma-separated) into a subreddit list.
 * Falls back to DEFAULT_SUBREDDITS when the var is absent or empty.
 * Handles extra whitespace, double commas, and trailing commas gracefully.
 */
export function parseSubredditList(envVar: string | undefined): string[] {
  if (!envVar || envVar.trim() === '') return DEFAULT_SUBREDDITS;
  const parsed = envVar.split(',').map(s => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_SUBREDDITS;
}

export { DEFAULT_SUBREDDITS };
