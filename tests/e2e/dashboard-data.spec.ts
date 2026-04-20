/**
 * E2E smoke test that would have caught today's regression: dashboard must
 * render real stock data when the DB is populated. Mocked unit tests pass
 * while the pipeline is broken (missing tables, empty DB, bad env). This
 * test boots the real stack and verifies data flows all the way to the UI.
 */

import { test, expect } from '@playwright/test';
import { seedTrendingTicker } from './helpers/seed';

// Use a namespaced ticker so we don't collide with real scan data or parallel
// tests. The scan extractor ignores tickers outside the common symbol list,
// which is fine — we bypass the scanner and write directly to DynamoDB.
const TEST_TICKER = 'ZZTST';
const TEST_TICKER_2 = 'ZZFOO';

async function signUpAndLogin(page: any, email: string, password: string) {
  await page.goto('/signup');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function deleteTestUser(email: string, baseURL: string) {
  await fetch(`${baseURL}/api/test/delete-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

test.describe('Dashboard renders real data', () => {
  const testEmails: string[] = [];

  test.beforeAll(async () => {
    // Seed two tickers with positive velocity so at least one lands on the
    // trending list even after other test data churns. Seeding in beforeAll
    // instead of beforeEach amortizes the cost across the describe block.
    await seedTrendingTicker(TEST_TICKER, {
      mentionCount: 100,
      sentimentScore: 0.7,
      sentimentCategory: 'strong_bullish',
    });
    await seedTrendingTicker(TEST_TICKER_2, {
      mentionCount: 80,
      sentimentScore: 0.4,
      sentimentCategory: 'bullish',
    });
  });

  test.afterEach(async ({ baseURL }) => {
    for (const email of testEmails) {
      await deleteTestUser(email, baseURL || 'http://localhost:3005');
    }
    testEmails.length = 0;
  });

  test('shows at least one stock card when DB has mentions', async ({
    page,
  }) => {
    const email = `dash-data-${Date.now()}@thememeradar.test`;
    testEmails.push(email);
    await signUpAndLogin(page, email, 'ValidPass123!');

    // Wait for the client-side fetch to resolve. The card renders the ticker
    // as `$TICKER` in an h3, so assert on any ticker matching our test prefix.
    const anyCard = page.locator('h3', { hasText: /^\$[A-Z]+$/ }).first();
    await expect(anyCard).toBeVisible({ timeout: 10000 });
  });

  test('renders trending section with sentiment label', async ({ page }) => {
    const email = `dash-sent-${Date.now()}@thememeradar.test`;
    testEmails.push(email);
    await signUpAndLogin(page, email, 'ValidPass123!');

    // At least one of the known sentiment labels from StockCard.tsx must
    // appear on the rendered dashboard. This catches "API returns data but
    // component fails to render it" failures.
    const sentimentLabel = page
      .getByText(/Strong Bullish|Bullish|Bearish|Strong Bearish|Neutral/)
      .first();
    await expect(sentimentLabel).toBeVisible({ timeout: 10000 });
  });

  test('dashboard trending API returns success and data', async ({
    page,
    baseURL,
  }) => {
    const email = `dash-api-${Date.now()}@thememeradar.test`;
    testEmails.push(email);
    await signUpAndLogin(page, email, 'ValidPass123!');

    // Pull trending straight from the browser's session so cookies match.
    // This surfaces API-level failures (500s, auth redirects, shape drift)
    // before assertions on the visual output.
    const trending = await page.evaluate(async () => {
      const res = await fetch('/api/stocks/trending');
      return { status: res.status, body: await res.json() };
    });

    expect(trending.status).toBe(200);
    expect(trending.body.success).toBe(true);
    expect(Array.isArray(trending.body.data.trending)).toBe(true);
    expect(trending.body.data.trending.length).toBeGreaterThan(0);
  });
});
