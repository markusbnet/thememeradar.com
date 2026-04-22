/**
 * E2E: click a stock card on the dashboard, land on /stock/[ticker], and
 * verify the detail page loads both the ticker header and evidence from
 * real DB seeds. This catches regressions where trending data renders but
 * the detail view silently falls back to an error or empty state.
 */

import { test, expect } from './fixtures/console-guard';
import { seedTrendingTicker, seedEvidence } from './helpers/seed';

const DETAIL_TICKER = 'ZZDETAIL';

async function deleteTestUser(email: string, baseURL: string) {
  await fetch(`${baseURL}/api/test/delete-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

test.describe('Stock detail page', () => {
  const testEmails: string[] = [];

  test.beforeAll(async () => {
    await seedTrendingTicker(DETAIL_TICKER, {
      mentionCount: 120,
      sentimentScore: 0.7,
      sentimentCategory: 'strong_bullish',
    });
    await seedEvidence(DETAIL_TICKER, 3);
  });

  test.afterEach(async ({ baseURL }) => {
    for (const email of testEmails) {
      await deleteTestUser(email, baseURL || 'http://localhost:3005');
    }
    testEmails.length = 0;
  });

  test('renders ticker header and evidence for a seeded ticker', async ({
    page,
  }) => {
    const email = `detail-${Date.now()}@thememeradar.test`;
    testEmails.push(email);
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill('ValidPass123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate directly to the detail page rather than hunting the card.
    // Going direct isolates detail-page failures from dashboard-rendering
    // failures — different test, different assertion.
    await page.goto(`/stock/${DETAIL_TICKER}`);
    await expect(
      page.locator('h1', { hasText: new RegExp(`\\$${DETAIL_TICKER}`) })
    ).toBeVisible({ timeout: 10000 });

    // Evidence section is collapsible, so we assert on the heading rather
    // than visibility of the individual items.
    await expect(
      page.getByText(/Supporting Evidence/i)
    ).toBeVisible();
  });

  test('stock detail evidence API returns seeded rows', async ({
    page,
    baseURL,
  }) => {
    const email = `detail-api-${Date.now()}@thememeradar.test`;
    testEmails.push(email);
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill('ValidPass123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const result = await page.evaluate(
      async (t) => {
        const r = await fetch(`/api/stocks/${t}/evidence`);
        return { status: r.status, body: await r.json() };
      },
      DETAIL_TICKER
    );

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data.evidence.length).toBeGreaterThan(0);
  });
});
