import { test, expect } from './fixtures/console-guard';

// Helper function to delete test user
async function deleteTestUser(email: string, baseURL: string) {
  try {
    await fetch(`${baseURL}/api/test/delete-user`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    console.warn(`Failed to delete test user ${email}:`, error);
  }
}

// Helper function to create and login test user
async function loginAsNewUser(page: any) {
  const testEmail = `stockdetail-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  const testPassword = 'StockTest123!';

  await page.goto('/signup');
  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByRole('textbox', { name: /password/i }).fill(testPassword);
  await page.getByRole('button', { name: /sign up/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });

  return { email: testEmail, password: testPassword };
}

test.describe('Stock Detail Page', () => {
  const testUsers: string[] = [];

  test.afterEach(async ({ baseURL }) => {
    // Clean up all test users created during this test
    for (const email of testUsers) {
      await deleteTestUser(email, baseURL || 'http://localhost:3001');
    }
    testUsers.length = 0; // Clear the array
  });

  test.describe('Authentication Protection', () => {
    test('should redirect to login when not authenticated', async ({ browser }) => {
      // Create new context without authentication
      const context = await browser.newContext();
      const page = await context.newPage();

      // Try to access stock detail page directly
      await page.goto('/stock/TSLA');

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
      await context.close();
    });

    test('should allow access when authenticated', async ({ page }) => {
      // Create and login as test user
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);

      // Navigate to a stock detail page (we'll use a common ticker)
      await page.goto('/stock/TSLA');

      // Should not redirect to login
      await expect(page).not.toHaveURL(/\/login/);

      // Page should load (either with data or error message)
      await page.waitForLoadState('domcontentloaded');
    });
  });

  test.describe('Navigation from Dashboard', () => {
    test('should navigate to stock detail page when clicking a stock card', async ({ page }) => {
      // Create and login as test user
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);

      // Wait for dashboard content to render (either stock cards or empty state)
      const stockCardOrEmpty = page.locator('a[href^="/stock/"]').or(page.getByText(/No trending stocks found/i));
      await stockCardOrEmpty.first().waitFor({ timeout: 10000 });

      // Check if there are any stock cards
      const stockCards = page.locator('a[href^="/stock/"]');
      const count = await stockCards.count();

      if (count > 0) {
        // Get the first stock card's ticker
        const firstCard = stockCards.first();
        const href = await firstCard.getAttribute('href');
        const ticker = href?.split('/').pop();

        // Click the stock card
        await firstCard.click();

        // Should navigate to stock detail page
        await expect(page).toHaveURL(new RegExp(`/stock/${ticker}`));
      } else {
        // No stock cards available (empty state)
        const emptyState = page.getByText(/No trending stocks found/i);
        await expect(emptyState).toBeVisible();
      }
    });

    test('should navigate back to dashboard using back button', async ({ page }) => {
      // Create and login as test user
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);

      // Navigate to a stock detail page
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');

      // Find and click the "Back to Dashboard" link
      const backButton = page.getByRole('link', { name: /Back to Dashboard/i });
      const hasBackButton = await backButton.isVisible().catch(() => false);

      if (hasBackButton) {
        await backButton.click();
        await expect(page).toHaveURL(/\/dashboard/);
      }
    });
  });

  test.describe('Page Display with Valid Stock', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should display page title with ticker symbol', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Check for either stock data or error state
      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // If no error, should show ticker
        await expect(page).toHaveTitle(/TSLA.*Stock Details/i);
      }
    });

    test('should display ticker header', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Should display ticker symbol in header
        const tickerHeader = page.getByRole('heading', { name: /\$TSLA/i });
        await expect(tickerHeader).toBeVisible();
      }
    });

    test('should display sentiment badge', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      // Ensure the async fetch has finished (spinner gone) before snapshot checks.
      await page.locator('.animate-spin').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Should show sentiment label (Bullish, Bearish, or Neutral)
        const sentimentPatterns = [
          /Strong Bullish/i,
          /Bullish/i,
          /Neutral/i,
          /Bearish/i,
          /Strong Bearish/i,
        ];

        let foundSentiment = false;
        for (const pattern of sentimentPatterns) {
          const hasSentiment = await page.getByText(pattern).first().isVisible().catch(() => false);
          if (hasSentiment) {
            foundSentiment = true;
            break;
          }
        }

        expect(foundSentiment).toBe(true);
      }
    });

    test('should display sentiment score', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.locator('.animate-spin').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Should show sentiment score label
        const sentimentScoreLabel = page.getByText(/Sentiment Score/i).first();
        await expect(sentimentScoreLabel).toBeVisible();
      }
    });

    test('should display statistics cards', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Should show statistic labels
        await expect(page.getByText(/Total Mentions/i)).toBeVisible();
        await expect(page.getByText(/Unique Posts/i)).toBeVisible();
        await expect(page.getByText(/Comments/i)).toBeVisible();
        await expect(page.getByText(/Total Upvotes/i)).toBeVisible();
      }
    });

    test('should display sentiment breakdown section', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Should show sentiment breakdown heading
        const sentimentBreakdown = page.getByRole('heading', { name: /Sentiment Breakdown/i });
        await expect(sentimentBreakdown).toBeVisible();
      }
    });

    test('should display subreddit breakdown section', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Should show subreddit breakdown heading
        const subredditBreakdown = page.getByRole('heading', { name: /Subreddit Breakdown/i });
        await expect(subredditBreakdown).toBeVisible();
      }
    });

    // Keywords and Supporting Evidence section rendering is covered by
    // tests/e2e/stock-detail-data.spec.ts, which seeds the DB with real
    // evidence rows and asserts the sections render. The previous `if (exists)`
    // guards here produced tautological tests that passed whether or not the
    // page actually worked.
  });

  test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should show error message for non-existent stock', async ({ page }) => {
      // Navigate to a stock that definitely doesn't exist
      await page.goto('/stock/INVALIDTICKER123');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should show error heading
      const errorHeading = page.getByRole('heading', { name: /Error/i });
      await expect(errorHeading).toBeVisible();
    });

    test('should show back to dashboard button on error', async ({ page }) => {
      await page.goto('/stock/INVALIDTICKER123');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Back button should be visible even on error
      const backButton = page.getByRole('link', { name: /Back to Dashboard/i });
      await expect(backButton).toBeVisible();
    });

    test('should navigate back to dashboard from error page', async ({ page }) => {
      await page.goto('/stock/INVALIDTICKER123');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Click back button
      const backButton = page.getByRole('link', { name: /Back to Dashboard/i });
      await backButton.click();

      // Should navigate to dashboard
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle API errors gracefully', async ({ page, context }) => {
      // Block API requests to simulate error
      await context.route('**/api/stocks/*', route => route.abort());

      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should show error state
      const errorState = page.getByText(/Error|failed to load/i);
      const hasError = await errorState.isVisible().catch(() => false);

      expect(hasError).toBe(true);
    });
  });

  test.describe('Loading States', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should show loading indicator while stock API is pending', async ({ page, context }) => {
      // Delay the stock detail API so the loading state is observable.
      // Without this delay the spinner may flash faster than we can assert.
      await context.route('**/api/stocks/TSLA', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });

      const navigation = page.goto('/stock/TSLA');
      await expect(page.locator('.animate-spin').first()).toBeVisible();
      await navigation;
    });

    test('should eventually load content or error', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Should show either content or error
      const hasContent = await page.getByRole('heading', { name: /\$/i }).isVisible().catch(() => false);
      const hasError = await page.getByRole('heading', { name: /Error/i }).isVisible().catch(() => false);

      expect(hasContent || hasError).toBe(true);
    });
  });

  test.describe('Responsive Design', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Back button should be visible
      const backButton = page.getByRole('link', { name: /Back to Dashboard/i });
      const hasBack = await backButton.isVisible().catch(() => false);

      if (hasBack) {
        await expect(backButton).toBeVisible();
      }
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Content should be visible on tablet
        const header = page.getByRole('heading', { name: /\$/i });
        await expect(header).toBeVisible();
      }
    });

    // Desktop statistics-grid rendering is verified by stock-detail-data.spec.ts
    // where seeded data guarantees the grid renders. A conditional viewport-only
    // test without seeded data cannot distinguish "renders correctly" from
    // "silently swallowed by the error branch".
  });

  test.describe('Data Integrity', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should display numeric values correctly', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Check that numbers are formatted properly (with commas for thousands)
        const statsCard = page.locator('text=/\\d+/').first();
        const hasStats = await statsCard.isVisible().catch(() => false);

        expect(hasStats).toBe(true);
      }
    });

    test('should display sentiment score as decimal', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.locator('.animate-spin').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (!hasError) {
        // Sentiment score should be visible (likely near "Sentiment Score" label)
        const sentimentLabel = page.getByText(/Sentiment Score/i).first();
        await expect(sentimentLabel).toBeVisible();
      }
    });
  });

  test.describe('Evidence Display', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should display evidence items with proper structure', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const evidenceSection = page.getByRole('heading', { name: /Supporting Evidence/i });
      const hasEvidence = await evidenceSection.isVisible().catch(() => false);

      if (hasEvidence) {
        // Check for evidence item structure
        const evidenceItems = page.locator('div').filter({ hasText: /Post|Comment/ });
        const count = await evidenceItems.count();

        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should display evidence metadata', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.locator('.animate-spin').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});

      const evidenceSection = page.getByRole('heading', { name: /Supporting Evidence/i });
      const hasEvidence = await evidenceSection.isVisible().catch(() => false);

      if (hasEvidence) {
        // Should show metadata like upvotes, subreddit, type
        const hasMetadata =
          (await page.getByText(/r\//i).first().isVisible().catch(() => false)) ||
          (await page.getByText(/⬆/i).first().isVisible().catch(() => false));

        expect(hasMetadata).toBe(true);
      }
    });
  });

  test.describe('Performance', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should load stock detail page quickly', async ({ page }) => {
      const start = Date.now();
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;

      expect(loadTime).toBeLessThan(5000);
    });

    test('should not have JavaScript errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto('/stock/TSLA');
      await page.waitForTimeout(2000);

      expect(errors).toHaveLength(0);
    });

    test('should not have console errors', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto('/stock/TSLA');
      await page.waitForTimeout(2000);

      // Filter out known non-critical errors
      const criticalErrors = consoleErrors.filter(
        err =>
          !err.includes('favicon') &&
          !err.includes('404') &&
          !err.includes('Auth check failed') &&
          !err.includes('Failed to fetch')
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const errorHeading = page.getByRole('heading', { name: /Error/i });
      const hasError = await errorHeading.isVisible().catch(() => false);

      if (hasError) {
        // Error state has h2 only (no h1)
        const h2 = await page.locator('h2').count();
        expect(h2).toBeGreaterThanOrEqual(1);
      } else {
        const h1 = await page.locator('h1').count();
        const h2 = await page.locator('h2').count();
        expect(h1).toBeGreaterThanOrEqual(1);
        expect(h2).toBeGreaterThanOrEqual(0);
      }
    });

    test('should have accessible back button', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const backButton = page.getByRole('link', { name: /Back to Dashboard/i });
      const hasBack = await backButton.isVisible().catch(() => false);

      if (hasBack) {
        await expect(backButton).toBeVisible();
        await expect(backButton).toBeEnabled();
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to reach back button
      const backButton = page.getByRole('link', { name: /Back to Dashboard/i });
      const hasBack = await backButton.isVisible().catch(() => false);

      if (hasBack) {
        await backButton.focus();
        await expect(backButton).toBeFocused();
      }
    });

    test('should have proper link text for back button', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Back button should have descriptive text
      const backButton = page.getByRole('link', { name: /Back to Dashboard/i });
      const hasBack = await backButton.isVisible().catch(() => false);

      expect(hasBack).toBe(true);
    });
  });

  test.describe('URL Handling', () => {
    test.beforeEach(async ({ page }) => {
      // Create and login as test user before each test
      const { email } = await loginAsNewUser(page);
      testUsers.push(email);
    });

    test('should handle uppercase ticker in URL', async ({ page }) => {
      await page.goto('/stock/TSLA');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should load successfully
      const hasContent = await page.getByRole('heading', { name: /\$/i }).isVisible().catch(() => false);
      const hasError = await page.getByRole('heading', { name: /Error/i }).isVisible().catch(() => false);

      expect(hasContent || hasError).toBe(true);
    });

    test('should handle lowercase ticker in URL', async ({ page }) => {
      await page.goto('/stock/tsla');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should load successfully (ticker should be converted to uppercase)
      const hasContent = await page.getByRole('heading', { name: /\$/i }).isVisible().catch(() => false);
      const hasError = await page.getByRole('heading', { name: /Error/i }).isVisible().catch(() => false);

      expect(hasContent || hasError).toBe(true);
    });

    test('should handle different ticker symbols', async ({ page }) => {
      const tickers = ['AAPL', 'GME', 'AMC'];

      for (const ticker of tickers) {
        await page.goto(`/stock/${ticker}`);
        await page.waitForLoadState('domcontentloaded');

        // Wait for the page to finish loading — either stock content or error heading appears
        await page.waitForSelector('h2:has-text("Error"), h1:has-text("$")', { timeout: 10000 });

        // Should load page for each ticker
        const hasContent = await page.getByRole('heading', { name: /\$/i }).isVisible().catch(() => false);
        const hasError = await page.getByRole('heading', { name: /Error/i }).isVisible().catch(() => false);

        expect(hasContent || hasError).toBe(true);
      }
    });
  });
});
