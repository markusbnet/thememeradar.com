/**
 * Single source of truth for env vars required to run the app locally.
 * Used by scripts/check-env.ts (predev guard) and tests/unit/env.test.ts
 * (which asserts .env.local.example documents each one).
 *
 * Optional/feature-gated vars (FINNHUB_API_KEY, LUNARCRUSH_API_KEY,
 * APEWISDOM_INGEST_SECRET, etc.) are intentionally not listed here — they
 * enable optional enrichments and their absence should not block boot.
 */

export const REQUIRED_ENV_VARS = [
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET',
  'REDDIT_USER_AGENT',
  'DYNAMODB_ENDPOINT',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'JWT_SECRET',
  'CRON_SECRET',
] as const;

export const PLACEHOLDER_MARKERS = [
  'your_',
  '_here',
  'change-in-production',
] as const;
