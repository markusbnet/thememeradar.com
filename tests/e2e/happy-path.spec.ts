/**
 * Task 72: E2E happy-path journey
 * signup → login → dashboard (stock cards) → stock detail → back → logout
 *
 * This single test proves the complete user flow works end-to-end.
 * If any step breaks, this test fails loudly.
 *
 * In remote/production mode (PLAYWRIGHT_BASE_URL=https://...) we skip seeding
 * because the in-memory API cache on Vercel may not reflect freshly written
 * DynamoDB rows within the test window. Real production data is always present
 * from active Reddit scans, so we just verify any stock card is visible.
 */

import { test, expect, type Locator } from './fixtures/console-guard';
import { seedTrendingTicker, seedEvidence } from './helpers/seed';

// Namespaced ticker to avoid collision with other tests
const TICKER = 'ZZHP';
const isRemote = (process.env.PLAYWRIGHT_BASE_URL ?? '').startsWith('https://');

async function deleteTestUser(email: string, baseURL: string) {
  await fetch(`${baseURL}/api/test/delete-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

test.describe('Happy path: complete user journey', () => {
  test.beforeAll(async () => {
    // In remote mode the production DB has real data from live Reddit scans;
    // skipping local DynamoDB seeding avoids the in-memory API cache race.
    if (!isRemote) {
      await seedTrendingTicker(TICKER, {
        mentionCount: 120,
        sentimentScore: 0.7,
        sentimentCategory: 'strong_bullish',
      });
      await seedEvidence(TICKER, 2);
    }
  });

  test('signup → login → dashboard → stock detail → back → logout', async ({
    page,
    baseURL,
  }) => {
    // Use a unique email each run so the test is hermetic
    const email = `happypath-${Date.now()}@thememeradar.test`;
    const password = 'TestUser123!';

    // ── Step 1: sign up a fresh test user ────────────────────────────────────
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Log out so we can exercise the login flow separately
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // ── Step 2: log in ────────────────────────────────────────────────────────
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);
    await page.getByRole('button', { name: /log in/i }).click();

    // ── Step 3: dashboard — trending stocks visible with at least one StockCard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    let stockCard: Locator;
    if (isRemote) {
      // Production smoke: rely on real Reddit scan data (always present in prod).
      // The in-memory API cache makes seeded tickers unreliable within the test
      // window, so we just verify that some stock card is visible.
      stockCard = page.locator('h3').filter({ hasText: /\$[A-Z]{1,5}/ }).first();
      await expect(stockCard).toBeVisible({ timeout: 20000 });
    } else {
      // Local CI: verify the seeded ticker specifically
      stockCard = page.locator('h3', { hasText: new RegExp(`\\$${TICKER}`) }).first();
      await expect(stockCard).toBeVisible({ timeout: 15000 });
    }

    // ── Step 4: click the first matching stock → stock detail page ────────────
    await stockCard.click();
    await page.waitForURL(/\/stock\/[A-Z]+/, { timeout: 10000 });

    // ── Step 5: stock page — ticker, sentiment, mention count, evidence ───────
    await expect(
      page.locator('h1').filter({ hasText: /\$[A-Z]{1,5}/ })
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText(/Strong Bullish|Bullish|Bearish|Strong Bearish|Neutral/i).first()
    ).toBeVisible();

    // The mentions stat block is always rendered
    await expect(page.getByText(/Total Mentions|Mentions/i).first()).toBeVisible();

    // Evidence section heading is rendered (section may be collapsed)
    await expect(page.getByText(/Supporting Evidence/i)).toBeVisible();

    // ── Step 6: navigate back to dashboard ────────────────────────────────────
    await page.getByRole('link', { name: /back|dashboard/i }).first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // ── Step 7: log out — assert redirect ────────────────────────────────────
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Accessing /dashboard without auth must redirect to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    // Cleanup
    await deleteTestUser(email, baseURL || 'http://localhost:3005');
  });
});
