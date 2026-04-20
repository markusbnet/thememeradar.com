/**
 * E2E for the dashboard empty state. Intercepts the data-fetching APIs and
 * returns empty arrays so we don't pollute DB state that other parallel
 * tests rely on. A blank dashboard is worse than a broken one — users can't
 * tell the difference between "loading", "no data yet", and "bug". This
 * test locks in the explicit empty-state message.
 */

import { test, expect } from '@playwright/test';

async function deleteTestUser(email: string, baseURL: string) {
  await fetch(`${baseURL}/api/test/delete-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

test.describe('Dashboard empty state', () => {
  const testEmails: string[] = [];

  test.afterEach(async ({ baseURL }) => {
    for (const email of testEmails) {
      await deleteTestUser(email, baseURL || 'http://localhost:3005');
    }
    testEmails.length = 0;
  });

  test('shows explicit message when no trending stocks', async ({
    page,
    baseURL,
  }) => {
    // Intercept before any page navigation so the dashboard's initial fetch
    // hits the mock. Use fulfill rather than abort so the page sees a valid
    // API shape and doesn't crash into an error boundary.
    await page.route('**/api/stocks/trending', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { trending: [], fading: [], timestamp: Date.now() },
        }),
      })
    );
    await page.route('**/api/stocks/surging', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { surges: [] } }),
      })
    );
    await page.route('**/api/stocks/opportunities', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { opportunities: [] } }),
      })
    );

    const email = `dash-empty-${Date.now()}@thememeradar.test`;
    testEmails.push(email);
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill('ValidPass123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Both trending and fading empty states must be visible so users know
    // the dashboard loaded but has nothing to show yet.
    await expect(
      page.getByText(/No trending stocks found/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/No fading stocks found/i)).toBeVisible();
  });
});
