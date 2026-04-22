/**
 * Task 76: Visual regression baseline — Playwright screenshot diffs
 *
 * Captures 8 baseline screenshots (4 routes × 2 viewports) and compares them
 * on every subsequent run. A 0.1% pixel diff threshold catches real regressions
 * while tolerating sub-pixel font-rendering differences.
 *
 * IMPORTANT: Before committing baseline PNGs, visually inspect each screenshot.
 * If a baseline captures broken UI (blank cards, layout shift, missing data),
 * fix the UI first. Run: npx playwright test visual.spec.ts --update-snapshots
 * to regenerate baselines after any intentional UI change.
 *
 * See tests/e2e/README.md for baseline update instructions.
 */

import { test, expect } from './fixtures/console-guard';
import { seedTrendingTicker, seedEvidence } from './helpers/seed';

// Single ticker seeded for all screenshots
const TICKER = 'ZZVIS';

const DESKTOP: import('@playwright/test').ViewportSize = { width: 1280, height: 800 };
const MOBILE: import('@playwright/test').ViewportSize = { width: 375, height: 667 };

let testEmail: string;

async function deleteTestUser(email: string, baseURL: string) {
  await fetch(`${baseURL}/api/test/delete-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

test.describe('Visual regression baselines', () => {
  test.beforeAll(async () => {
    await seedTrendingTicker(TICKER, {
      mentionCount: 100,
      sentimentScore: 0.65,
      sentimentCategory: 'strong_bullish',
    });
    await seedEvidence(TICKER, 2);
  });

  // Create a shared user before each test (desktop and mobile suites run separately)
  test.beforeEach(async ({ page }) => {
    testEmail = `visual-${Date.now()}@thememeradar.test`;
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByRole('textbox', { name: /password/i }).fill('TestUser123!');
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test.afterEach(async ({ baseURL }) => {
    await deleteTestUser(testEmail, baseURL || 'http://localhost:3005');
  });

  test.describe('Desktop (1280×800)', () => {
    test.use({ viewport: DESKTOP });

    test('login page baseline', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page).toHaveScreenshot('login-desktop.png', { maxDiffPixelRatio: 0.001 });
    });

    test('signup page baseline', async ({ page }) => {
      await page.goto('/signup');
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page).toHaveScreenshot('signup-desktop.png', { maxDiffPixelRatio: 0.001 });
    });

    test('dashboard page baseline', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('textbox', { name: /password/i }).fill('TestUser123!');
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      // Wait for stock data to load before capturing
      await page.locator('h3', { hasText: new RegExp(`\\$${TICKER}`) }).waitFor({ timeout: 10000 });
      await expect(page).toHaveScreenshot('dashboard-desktop.png', { maxDiffPixelRatio: 0.001 });
    });

    test('stock detail page baseline', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('textbox', { name: /password/i }).fill('TestUser123!');
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      await page.goto(`/stock/${TICKER}`);
      await page.locator('h1', { hasText: new RegExp(`\\$${TICKER}`) }).waitFor({ timeout: 10000 });
      await expect(page).toHaveScreenshot('stock-detail-desktop.png', { maxDiffPixelRatio: 0.001 });
    });
  });

  test.describe('Mobile (375×667)', () => {
    test.use({ viewport: MOBILE });

    test('login page baseline', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page).toHaveScreenshot('login-mobile.png', { maxDiffPixelRatio: 0.001 });
    });

    test('signup page baseline', async ({ page }) => {
      await page.goto('/signup');
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page).toHaveScreenshot('signup-mobile.png', { maxDiffPixelRatio: 0.001 });
    });

    test('dashboard page baseline', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('textbox', { name: /password/i }).fill('TestUser123!');
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      await page.locator('h3', { hasText: new RegExp(`\\$${TICKER}`) }).waitFor({ timeout: 10000 });
      await expect(page).toHaveScreenshot('dashboard-mobile.png', { maxDiffPixelRatio: 0.001 });
    });

    test('stock detail page baseline', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('textbox', { name: /password/i }).fill('TestUser123!');
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      await page.goto(`/stock/${TICKER}`);
      await page.locator('h1', { hasText: new RegExp(`\\$${TICKER}`) }).waitFor({ timeout: 10000 });
      await expect(page).toHaveScreenshot('stock-detail-mobile.png', { maxDiffPixelRatio: 0.001 });
    });
  });
});
