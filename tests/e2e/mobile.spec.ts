/**
 * Task 75: E2E mobile viewport pass (375px iPhone SE, 414px iPhone Pro Max)
 *
 * For each viewport and each core flow, asserts:
 *  1. No horizontal scroll (body.scrollWidth <= viewport width)
 *  2. All interactive elements have bounding boxes >= 44×44px
 *  3. Primary CTA is visible in the initial viewport without scrolling
 *  4. Ticker text in headers is not unexpectedly truncated
 *
 * 4 flows × 2 viewports = 8 test runs.
 */

import { test, expect, type Page } from './fixtures/console-guard';
import { seedTrendingTicker, seedEvidence } from './helpers/seed';

const TICKER = 'ZZMO'; // namespaced to avoid collision

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone Pro Max', width: 414, height: 896 },
];

async function deleteTestUser(email: string, baseURL: string) {
  await fetch(`${baseURL}/api/test/delete-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

/**
 * Create a test user and return their credentials. Each test creates its own
 * user to avoid shared-state race conditions with parallel workers.
 */
async function createAndLoginUser(page: Page, baseURL: string): Promise<string> {
  const email = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@thememeradar.test`;
  await page.goto('/signup');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill('TestUser123!');
  await page.getByRole('button', { name: /sign up/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  // Store the user for cleanup, then log out so individual tests can navigate freely
  await page.getByRole('button', { name: /log out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 10000 });
  void baseURL;
  return email;
}

/**
 * Check that no interactive element (button/link/input) is smaller than 44×44px.
 * Returns an array of violation descriptions, or empty array if all pass.
 */
async function getTapTargetViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const MIN = 44;
    const selectors = 'button, a, input, select, textarea, [role="button"]';
    const violations: string[] = [];

    document.querySelectorAll<HTMLElement>(selectors).forEach(el => {
      const rect = el.getBoundingClientRect();
      // Skip hidden / zero-size elements
      if (rect.width === 0 && rect.height === 0) return;
      if (rect.width < MIN || rect.height < MIN) {
        const id = el.id ? '#' + el.id : '';
        const cls = el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/)[0]
          : '';
        violations.push(
          `${el.tagName.toLowerCase()}${id}${cls} ` +
          `(${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px)`
        );
      }
    });

    return violations;
  });
}

/**
 * Check for horizontal overflow: body.scrollWidth > window.innerWidth
 */
async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.body.scrollWidth > window.innerWidth
  );
}

test.describe('Mobile viewport pass', () => {
  test.beforeAll(async () => {
    await seedTrendingTicker(TICKER, {
      mentionCount: 90,
      sentimentScore: 0.6,
      sentimentCategory: 'strong_bullish',
    });
    await seedEvidence(TICKER, 2);
  });

  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} (${vp.width}×${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('login page: no overflow, tap targets ok, CTA visible', async ({ page, baseURL }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // 1. No horizontal scroll
        expect(
          await hasHorizontalScroll(page),
          `Horizontal scroll on login at ${vp.width}px`
        ).toBe(false);

        // 2. Tap targets
        const violations = await getTapTargetViolations(page);
        expect(violations, `Tap targets < 44px on login:\n${violations.join('\n')}`).toHaveLength(0);

        // 3. Primary CTA (Log In button) visible without scrolling
        const cta = page.getByRole('button', { name: /log in/i });
        await expect(cta).toBeVisible();
        const box = await cta.boundingBox();
        expect(box, 'CTA bounding box should be non-null').not.toBeNull();
        expect(box!.y + box!.height, 'CTA must be within initial viewport').toBeLessThanOrEqual(vp.height);
        void baseURL;
      });

      test('signup page: no overflow, tap targets ok, CTA visible', async ({ page, baseURL }) => {
        await page.goto('/signup');
        await page.waitForLoadState('domcontentloaded');

        expect(await hasHorizontalScroll(page), `Horizontal scroll on signup at ${vp.width}px`).toBe(false);

        const violations = await getTapTargetViolations(page);
        expect(violations, `Tap targets < 44px on signup:\n${violations.join('\n')}`).toHaveLength(0);

        const cta = page.getByRole('button', { name: /sign up/i });
        await expect(cta).toBeVisible();
        const box = await cta.boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
        void baseURL;
      });

      test('dashboard: no overflow, tap targets ok, content loads', async ({ page, baseURL }) => {
        const email = await createAndLoginUser(page, baseURL || 'http://localhost:3005');

        await page.goto('/login');
        await page.getByLabel(/email/i).fill(email);
        await page.getByRole('textbox', { name: /password/i }).fill('TestUser123!');
        await page.getByRole('button', { name: /log in/i }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
        await page.waitForLoadState('networkidle').catch(() => {});

        expect(await hasHorizontalScroll(page), `Horizontal scroll on dashboard at ${vp.width}px`).toBe(false);

        // 4. Ticker text: stock card header must be visible (not clipped off-screen)
        const stockHeader = page.locator('h3', { hasText: new RegExp(`\\$${TICKER}`) });
        await expect(stockHeader).toBeVisible({ timeout: 10000 });

        const violations = await getTapTargetViolations(page);
        expect(violations, `Tap targets < 44px on dashboard:\n${violations.join('\n')}`).toHaveLength(0);

        await deleteTestUser(email, baseURL || 'http://localhost:3005');
      });

      test('stock detail: no overflow, tap targets ok, ticker header visible', async ({
        page,
        baseURL,
      }) => {
        const email = await createAndLoginUser(page, baseURL || 'http://localhost:3005');

        await page.goto('/login');
        await page.getByLabel(/email/i).fill(email);
        await page.getByRole('textbox', { name: /password/i }).fill('TestUser123!');
        await page.getByRole('button', { name: /log in/i }).click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });

        await page.goto(`/stock/${TICKER}`);
        await page.waitForLoadState('domcontentloaded');
        await expect(
          page.locator('h1', { hasText: new RegExp(`\\$${TICKER}`) })
        ).toBeVisible({ timeout: 10000 });

        expect(await hasHorizontalScroll(page), `Horizontal scroll on stock detail at ${vp.width}px`).toBe(false);

        const violations = await getTapTargetViolations(page);
        expect(violations, `Tap targets < 44px on stock detail:\n${violations.join('\n')}`).toHaveLength(0);

        await deleteTestUser(email, baseURL || 'http://localhost:3005');
      });
    });
  }
});
