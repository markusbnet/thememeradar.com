/**
 * Validates that .env.local is populated with real values before the dev
 * server starts. Runs as part of `predev`. The goal is that a fresh clone
 * can't silently boot into a broken state — missing or placeholder values
 * produce a clear, actionable error here instead of surfacing as a 401 or
 * a cryptic "credentials not configured" at request time.
 *
 * Source of truth for which vars are required lives in scripts/env-required.ts
 * so the unit test and this script agree.
 */

import { REQUIRED_ENV_VARS, PLACEHOLDER_MARKERS } from './env-required';

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) =>
    value.toLowerCase().includes(marker)
  );
}

const missing: string[] = [];
const placeholder: string[] = [];

for (const key of REQUIRED_ENV_VARS) {
  const value = process.env[key];
  if (!value) {
    missing.push(key);
  } else if (isPlaceholder(value)) {
    placeholder.push(key);
  }
}

if (missing.length === 0 && placeholder.length === 0) {
  console.log('✓ Environment variables look good');
  process.exit(0);
}

console.error('\n✗ .env.local is not ready for local development\n');

if (missing.length > 0) {
  console.error('  Missing:');
  for (const key of missing) console.error(`    - ${key}`);
}

if (placeholder.length > 0) {
  console.error('  Still set to placeholder values:');
  for (const key of placeholder) console.error(`    - ${key}`);
}

console.error(
  '\n  Fix:\n' +
    '    1. Copy .env.local.example → .env.local if you have not already.\n' +
    '    2. Fill in real values. For this project you can pull production\n' +
    '       values with: vercel env pull .env.local --environment=production\n' +
    "    3. Generate CRON_SECRET / JWT_SECRET with: openssl rand -base64 32\n"
);

process.exit(1);
