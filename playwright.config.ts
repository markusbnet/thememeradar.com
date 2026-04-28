import { defineConfig, devices } from '@playwright/test';

// Some E2E tests seed DynamoDB directly from Node (inside the test runner,
// not inside the webServer). Those imports read process.env at module load
// time, so defaults must be set before @playwright/test loads the specs.
// Only populate values the caller hasn't already provided — CI can override.
process.env.DYNAMODB_ENDPOINT ??= 'http://localhost:8000';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'test';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit parallel workers to avoid overwhelming the dev server */
  workers: process.env.CI ? 1 : 3,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests (only if not testing external URL).
   * The command runs `npm run dev`, which triggers `predev` → check-env + db:init. If a required
   * env var is missing locally, Playwright will fail fast with the same message a fresh clone sees.
   * We inherit the full parent env so .env.local values (CRON_SECRET, JWT_SECRET, REDDIT_*) reach
   * the spawned server. The `env` overrides below pin the ones that must be deterministic for tests. */
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    // In CI the build artifact already exists (built in a prior step), so
    // `next start` is used — it comes up in ~1s vs 60-120s for `next dev`.
    command: process.env.CI ? 'npx next start -p 3005' : 'PORT=3005 npm run dev',
    url: 'http://localhost:3005',
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 30000 : 60000,
    env: {
      DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'test',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      USERS_TABLE_NAME: process.env.USERS_TABLE_NAME || 'users',
      AUTH_RATE_LIMIT_MAX: '1000',
    },
  },
});
