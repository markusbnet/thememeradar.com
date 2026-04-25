import { test, expect } from './fixtures/console-guard';

test.describe('/m mobile view', () => {
  test('renders the page without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    const response = await page.goto('/m');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();

    await context.close();
  });

  test('page renders a table with at least one ticker row', async ({ page }) => {
    await page.goto('/m');

    await expect(page.locator('table')).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('each row has a ticker, velocity, and price column', async ({ page }) => {
    await page.goto('/m');

    const firstRow = page.locator('tbody tr').first();
    const cells = firstRow.locator('td');
    await expect(cells).toHaveCount(4); // rank, ticker, velocity, price
  });

  test('page has a link back to the full dashboard', async ({ page }) => {
    await page.goto('/m');
    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
  });

  test('page title is Meme Radar', async ({ page }) => {
    await page.goto('/m');
    await expect(page).toHaveTitle(/Meme Radar/i);
  });
});
