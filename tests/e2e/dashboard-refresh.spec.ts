/**
 * End-to-end regression for the Refresh button. Covers the bug that shipped
 * with green unit tests: `RefreshTimer` called `router.refresh()`, which
 * re-ran server components but left the dashboard's client-side fetches
 * untouched — so the button did nothing visible.
 *
 * Test shape:
 *   1. Seed DB with mentions for a ticker, load dashboard, assert it renders.
 *   2. Increase that ticker's mention count in the DB.
 *   3. Click Refresh.
 *   4. Assert the new count is visible without reloading the page.
 *
 * If Refresh stops re-fetching, step 4 fails. If it re-fetches but the UI
 * doesn't rerender with new state, step 4 also fails.
 */

import { test, expect, type Page } from './fixtures/console-guard';
import { seedTrendingTicker } from './helpers/seed';

const REFRESH_TICKER = 'ZZREFRESH';
const INITIAL_MENTIONS = 25;
const UPDATED_MENTIONS = 77;

async function signUpAndLogin(page: Page, email: string, password: string) {
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

test.describe('Dashboard Refresh button re-fetches data', () => {
  const testEmails: string[] = [];

  test.afterEach(async ({ baseURL }) => {
    for (const email of testEmails) {
      await deleteTestUser(email, baseURL || 'http://localhost:3005');
    }
    testEmails.length = 0;
  });

  test('clicking Refresh reflects new mention counts without a page reload', async ({
    page,
  }) => {
    await seedTrendingTicker(REFRESH_TICKER, {
      mentionCount: INITIAL_MENTIONS,
      sentimentScore: 0.5,
      sentimentCategory: 'bullish',
    });

    const email = `dash-refresh-${Date.now()}@thememeradar.test`;
    testEmails.push(email);
    await signUpAndLogin(page, email, 'ValidPass123!');

    // Initial render shows the seeded count.
    await expect(
      page.getByRole('heading', { name: `$${REFRESH_TICKER}` })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(String(INITIAL_MENTIONS)).first()).toBeVisible();

    // Capture the page's current frame identity so we can later assert it
    // didn't change — a full navigation would rebuild the main frame and
    // make the "without reload" claim meaningless.
    const frameBefore = page.mainFrame();

    // Re-seed with a higher mention count. `seedTrendingTicker` writes into
    // the same 15-min bucket, so a PutCommand overwrites the row.
    await seedTrendingTicker(REFRESH_TICKER, {
      mentionCount: UPDATED_MENTIONS,
      sentimentScore: 0.5,
      sentimentCategory: 'bullish',
    });

    await page.getByRole('button', { name: /^refresh$/i }).click();

    // New count must appear. This is the assertion that would have caught
    // the `router.refresh()`-only bug — the API call goes through but the
    // client-fetched state never updated.
    await expect(page.getByText(String(UPDATED_MENTIONS)).first()).toBeVisible({
      timeout: 5000,
    });

    // Old count should be gone for this card.
    const card = page
      .locator('a', { has: page.getByRole('heading', { name: `$${REFRESH_TICKER}` }) })
      .first();
    await expect(card.getByText(String(INITIAL_MENTIONS))).toHaveCount(0);

    // Frame identity unchanged → no full navigation occurred.
    expect(page.mainFrame()).toBe(frameBefore);
  });
});
