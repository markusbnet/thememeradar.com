import { defineConfig, devices } from '@playwright/test';

/**
 * Production smoke test config — runs against the live Vercel URL.
 * ~17 tests covering landing page, auth protection, and the full happy path.
 * Seed helpers auto-route through /api/test/* so no AWS credentials needed
 * in the CI runner.
 *
 * The full 258-test suite runs in CI against local DynamoDB (playwright.config.ts).
 */

// Prevent the base playwright.config.ts defaults from forcing local DynamoDB.
// Seed helpers detect PLAYWRIGHT_BASE_URL=https://... and use API endpoints.
process.env.DYNAMODB_ENDPOINT ??= 'https://dynamodb.us-east-1.amazonaws.com';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'unused-in-remote-mode';
process.env.AWS_SECRET_ACCESS_KEY ??= 'unused-in-remote-mode';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    '**/happy-path.spec.ts',
    '**/landing.spec.ts',
    '**/dashboard.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 4,
  reporter: 'html',
  expect: { timeout: 20000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://thememeradarcom.vercel.app',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
