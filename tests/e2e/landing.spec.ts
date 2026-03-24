import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display landing page with all required elements', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/Meme Radar/i);

    // Check main heading
    await expect(page.getByRole('heading', { name: /The Meme Radar/i })).toBeVisible();

    // Check tagline
    await expect(page.getByText(/Track meme stock trends from Reddit in real-time/i)).toBeVisible();

    // Check Log In button
    await expect(page.getByRole('link', { name: /Log In/i })).toBeVisible();

    // Check Sign Up button
    await expect(page.getByRole('link', { name: /Sign Up/i })).toBeVisible();
  });

  test('should navigate to login page when clicking Log In button', async ({ page }) => {
    await page.getByRole('link', { name: /Log In/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate to signup page when clicking Sign Up button', async ({ page }) => {
    await page.getByRole('link', { name: /Sign Up/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should have correct styling and layout', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /The Meme Radar/i });

    // Check heading is visible and has expected font size
    await expect(heading).toBeVisible();
    const fontSize = await heading.evaluate(el => window.getComputedStyle(el).fontSize);
    expect(parseFloat(fontSize)).toBeGreaterThan(30); // Should be large (text-5xl)
  });

  test('should display buttons with correct colors', async ({ page }) => {
    const loginButton = page.getByRole('link', { name: /Log In/i });
    const signupButton = page.getByRole('link', { name: /Sign Up/i });

    // Login button should have background color
    const loginBg = await loginButton.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(loginBg).toBeTruthy();
    expect(loginBg).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent

    // Signup button should have border
    const signupBorder = await signupButton.evaluate(el => window.getComputedStyle(el).borderWidth);
    expect(parseFloat(signupBorder)).toBeGreaterThan(0); // Has border
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    // Elements should still be visible
    await expect(page.getByRole('heading', { name: /The Meme Radar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Log In/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign Up/i })).toBeVisible();
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad size

    await expect(page.getByRole('heading', { name: /The Meme Radar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Log In/i })).toBeVisible();
  });

  test('should handle navigation with keyboard', async ({ page }) => {
    // Tab to first link
    await page.keyboard.press('Tab');

    // Should focus on Log In button
    const loginButton = page.getByRole('link', { name: /Log In/i });
    await expect(loginButton).toBeFocused();

    // Press Enter to navigate
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('should load quickly (performance check)', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - start;

    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});
