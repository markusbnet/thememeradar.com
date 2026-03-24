import { test, expect } from '@playwright/test';

/**
 * COMPREHENSIVE USER JOURNEY E2E TESTS
 * These tests simulate complete real-world user workflows from start to finish
 */

test.describe('Complete User Journeys', () => {
  // Generate unique email for each test run
  const generateEmail = () => `journey-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  test.describe('New User Complete Journey', () => {
    test('should complete full signup -> dashboard -> logout journey', async ({ page }) => {
      const email = generateEmail();
      const password = 'Journey123!';

      // 1. Land on homepage
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Meme Radar/i })).toBeVisible();

      // 2. Click Sign Up
      await page.getByRole('link', { name: /Sign Up/i }).click();
      await expect(page).toHaveURL(/\/signup/);

      // 3. Fill signup form
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);

      // 4. Submit form
      await page.getByRole('button', { name: /sign up/i }).click();

      // 5. Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);

      // 6. Verify user is logged in
      await expect(page.getByText(/Welcome back/i)).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();

      // 7. Verify dashboard content loaded
      await expect(page.getByText(/Top 10 Trending/i)).toBeVisible();
      await expect(page.getByText(/Top 10 Fading/i)).toBeVisible();

      // 8. Logout
      await page.getByRole('button', { name: /Log Out/i }).click();

      // 9. Should redirect to login
      await expect(page).toHaveURL(/\/login/);

      // 10. Verify logged out (try accessing dashboard)
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should complete signup -> login -> dashboard -> reload -> still authenticated journey', async ({
      page,
    }) => {
      const email = generateEmail();
      const password = 'Persist123!';

      // 1. Sign up
      await page.goto('/signup');
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // 2. Reload page
      await page.reload();

      // 3. Should still be on dashboard (session persisted)
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/Welcome back/i)).toBeVisible();

      // 4. Navigate away and back
      await page.goto('/');
      await page.goto('/dashboard');

      // 5. Should still be authenticated
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(email)).toBeVisible();

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });
  });

  test.describe('Returning User Journey', () => {
    test('should complete login -> dashboard -> view stocks -> logout journey', async ({ page }) => {
      const email = generateEmail();
      const password = 'Return123!';

      // Setup: Create user
      await page.goto('/signup');
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // Logout
      await page.getByRole('button', { name: /Log Out/i }).click();

      // Journey starts: Returning user logs in
      // 1. Go to login page
      await page.goto('/login');

      // 2. Fill login form
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);

      // 3. Submit login
      await page.getByRole('button', { name: /log in/i }).click();

      // 4. Should be on dashboard
      await expect(page).toHaveURL(/\/dashboard/);

      // 5. Verify user info displayed
      await expect(page.getByText(/Welcome back/i)).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();

      // 6. Check dashboard sections are visible
      await expect(page.getByText(/Top 10 Trending/i)).toBeVisible();
      await expect(page.getByText(/Top 10 Fading/i)).toBeVisible();

      // 7. Logout
      await page.getByRole('button', { name: /Log Out/i }).click();
      await expect(page).toHaveURL(/\/login/);

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });
  });

  test.describe('Error Recovery Journeys', () => {
    test('should recover from signup error and successfully sign up on retry', async ({ page }) => {
      const email = generateEmail();
      const password = 'Recover123!';

      // 1. Try signup with weak password
      await page.goto('/signup');
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill('weak');
      await page.getByRole('button', { name: /sign up/i }).click();

      // 2. Should show error
      await expect(page.getByText(/password/i)).toBeVisible();

      // 3. Fix password and retry
      await page.getByRole('textbox', { name: /password/i }).clear();
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();

      // 4. Should succeed
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/Welcome back/i)).toBeVisible();

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should recover from login error and successfully login on retry', async ({ page }) => {
      const email = generateEmail();
      const password = 'LoginRecover123!';

      // Setup: Create user
      await page.request.post('/api/auth/signup', {
        data: { email, password },
      });

      // Journey: Try login with wrong password
      await page.goto('/login');

      // 1. Wrong password attempt
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill('WrongPassword123!');
      await page.getByRole('button', { name: /log in/i }).click();

      // 2. Should show error
      await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();

      // 3. Retry with correct password
      await page.getByRole('textbox', { name: /password/i }).clear();
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /log in/i }).click();

      // 4. Should succeed
      await expect(page).toHaveURL(/\/dashboard/);

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle network failure and retry', async ({ page, context }) => {
      const email = generateEmail();
      const password = 'Network123!';

      // Setup: Create user
      await page.request.post('/api/auth/signup', {
        data: { email, password },
      });

      await page.goto('/login');

      // 1. Block network during login
      await context.route('**/api/auth/login', (route) => route.abort());

      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /log in/i }).click();

      // 2. Wait a bit for error state
      await page.waitForTimeout(1000);

      // 3. Unblock network
      await context.unroute('**/api/auth/login');

      // 4. Retry login
      await page.getByRole('button', { name: /log in/i }).click();

      // 5. Should succeed
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });
  });

  test.describe('Multi-Tab Session Journeys', () => {
    test('should maintain session across multiple tabs', async ({ context }) => {
      const email = generateEmail();
      const password = 'MultiTab123!';

      // Tab 1: Sign up
      const page1 = await context.newPage();
      await page1.goto('/signup');
      await page1.getByLabel(/email/i).fill(email);
      await page1.getByRole('textbox', { name: /password/i }).fill(password);
      await page1.getByRole('button', { name: /sign up/i }).click();
      await expect(page1).toHaveURL(/\/dashboard/);

      // Tab 2: Should be able to access dashboard with same session
      const page2 = await context.newPage();
      await page2.goto('/dashboard');
      await expect(page2).toHaveURL(/\/dashboard/);
      await expect(page2.getByText(/Welcome back/i)).toBeVisible();

      // Both tabs should show user email
      await expect(page1.getByText(email)).toBeVisible();
      await expect(page2.getByText(email)).toBeVisible();

      // Cleanup
      await page1.request.delete('/api/test/delete-user', {
        data: { email },
      });

      await page1.close();
      await page2.close();
    });

    test('should logout from all tabs when logging out from one', async ({ context }) => {
      const email = generateEmail();
      const password = 'Logout123!';

      // Setup: Create user and login
      const page1 = await context.newPage();
      await page1.goto('/signup');
      await page1.getByLabel(/email/i).fill(email);
      await page1.getByRole('textbox', { name: /password/i }).fill(password);
      await page1.getByRole('button', { name: /sign up/i }).click();
      await expect(page1).toHaveURL(/\/dashboard/);

      // Open second tab
      const page2 = await context.newPage();
      await page2.goto('/dashboard');
      await expect(page2).toHaveURL(/\/dashboard/);

      // Logout from first tab
      await page1.getByRole('button', { name: /Log Out/i }).click();
      await expect(page1).toHaveURL(/\/login/);

      // Try to access dashboard from second tab
      await page2.reload();
      await expect(page2).toHaveURL(/\/login/);

      // Cleanup
      await page1.request.delete('/api/test/delete-user', {
        data: { email },
      });

      await page1.close();
      await page2.close();
    });
  });

  test.describe('Browser Navigation Journeys', () => {
    test('should handle browser back/forward buttons correctly', async ({ page }) => {
      const email = generateEmail();
      const password = 'NavTest123!';

      // 1. Homepage
      await page.goto('/');
      await expect(page).toHaveURL('/');

      // 2. Navigate to signup
      await page.getByRole('link', { name: /Sign Up/i }).click();
      await expect(page).toHaveURL(/\/signup/);

      // 3. Navigate to login via link
      await page.getByRole('link', { name: /log in/i }).click();
      await expect(page).toHaveURL(/\/login/);

      // 4. Browser back to signup
      await page.goBack();
      await expect(page).toHaveURL(/\/signup/);

      // 5. Browser forward to login
      await page.goForward();
      await expect(page).toHaveURL(/\/login/);

      // 6. Browser back to signup
      await page.goBack();
      await expect(page).toHaveURL(/\/signup/);

      // 7. Complete signup
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // 8. Browser back (should stay on dashboard or go to login, not signup)
      await page.goBack();
      // Should not be able to go back to signup when authenticated
      expect(page.url()).toMatch(/\/(dashboard|login)/);

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });
  });

  test.describe('Form Interaction Journeys', () => {
    test('should complete signup using only keyboard', async ({ page }) => {
      const email = generateEmail();
      const password = 'Keyboard123!';

      await page.goto('/signup');

      // Tab to email field
      await page.keyboard.press('Tab');
      await page.keyboard.type(email);

      // Tab to password field
      await page.keyboard.press('Tab');
      await page.keyboard.type(password);

      // Tab to submit button and press Enter
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Should successfully sign up
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle form autofill correctly', async ({ page }) => {
      const email = generateEmail();
      const password = 'Autofill123!';

      // Sign up first
      await page.goto('/signup');
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // Logout
      await page.getByRole('button', { name: /Log Out/i }).click();

      // Try login with autofill
      await page.goto('/login');

      // Simulate autofill by filling fields programmatically
      await page.evaluate(
        ({ email, password }) => {
          const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
          const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

          if (emailInput) emailInput.value = email;
          if (passwordInput) passwordInput.value = password;

          // Trigger input events
          emailInput?.dispatchEvent(new Event('input', { bubbles: true }));
          passwordInput?.dispatchEvent(new Event('input', { bubbles: true }));
        },
        { email, password }
      );

      // Submit form
      await page.getByRole('button', { name: /log in/i }).click();

      // Should succeed
      await expect(page).toHaveURL(/\/dashboard/);

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });
  });

  test.describe('Mobile User Journeys', () => {
    test('should complete full journey on mobile device', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      const email = generateEmail();
      const password = 'Mobile123!';

      // 1. Land on homepage
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Meme Radar/i })).toBeVisible();

      // 2. Navigate to signup
      await page.getByRole('link', { name: /Sign Up/i }).click();
      await expect(page).toHaveURL(/\/signup/);

      // 3. Fill form on mobile
      await page.getByLabel(/email/i).tap();
      await page.getByLabel(/email/i).fill(email);

      await page.getByRole('textbox', { name: /password/i }).tap();
      await page.getByRole('textbox', { name: /password/i }).fill(password);

      // 4. Submit
      await page.getByRole('button', { name: /sign up/i }).tap();

      // 5. Should reach dashboard
      await expect(page).toHaveURL(/\/dashboard/);

      // 6. Verify mobile layout
      await expect(page.getByText(/Welcome back/i)).toBeVisible();

      // 7. Scroll down
      await page.evaluate(() => window.scrollBy(0, 500));

      // 8. Check sections visible
      await expect(page.getByText(/Top 10 Trending/i)).toBeVisible();

      // 9. Logout
      await page.getByRole('button', { name: /Log Out/i }).tap();
      await expect(page).toHaveURL(/\/login/);

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle orientation change', async ({ page }) => {
      const email = generateEmail();
      const password = 'Orientation123!';

      // Create user
      await page.request.post('/api/auth/signup', {
        data: { email, password },
      });

      // Portrait mode
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/login');

      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /log in/i }).click();

      await expect(page).toHaveURL(/\/dashboard/);

      // Rotate to landscape
      await page.setViewportSize({ width: 667, height: 375 });

      // Content should still be visible
      await expect(page.getByText(/Welcome back/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Log Out/i })).toBeVisible();

      // Rotate back to portrait
      await page.setViewportSize({ width: 375, height: 667 });

      // Content should still be visible
      await expect(page.getByText(/Welcome back/i)).toBeVisible();

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });
  });

  test.describe('Performance Journeys', () => {
    test('should load dashboard quickly for authenticated user', async ({ page }) => {
      const email = generateEmail();
      const password = 'Perf123!';

      // Setup
      await page.request.post('/api/auth/signup', {
        data: { email, password },
      });

      await page.goto('/login');
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /log in/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // Measure reload performance
      const start = Date.now();
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;

      // Should load in reasonable time
      expect(loadTime).toBeLessThan(3000);

      // Dashboard content should be visible
      await expect(page.getByText(/Welcome back/i)).toBeVisible();

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });
  });
});
