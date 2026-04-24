import { type Page } from '@playwright/test';
import { test, expect } from './fixtures/console-guard';

const RUN_ID = Date.now();

async function deleteUser(page: Page, email: string) {
  try {
    await page.request.delete('/api/test/delete-user', { data: { email } });
  } catch {
    // Best-effort cleanup
  }
}

test.describe('Auth edge cases', () => {
  test.describe('Login error handling', () => {
    test('wrong password shows error and stays on login page', async ({ page }) => {
      const email = `edge-wrong-pw-${RUN_ID}@test.com`;
      const password = 'ValidPass1!';

      await page.request.post('/api/auth/signup', { data: { email, password } });

      try {
        await page.goto('/login');
        await page.fill('#email', email);
        await page.fill('#password', 'TotallyWrong99!');
        await page.click('button[type="submit"]');

        await expect(page.getByText('Invalid email or password')).toBeVisible();
        await expect(page).toHaveURL(/\/login/);
      } finally {
        await deleteUser(page, email);
      }
    });

    test('login rate limit — UI shows "Too many attempts" when API returns 429', async ({ page }) => {
      // Simulate rate limiting: first 5 attempts get 401, 6th gets 429.
      // AUTH_RATE_LIMIT_MAX=1000 in test env prevents real exhaustion,
      // so we use page.route() to verify the UI handles 429 correctly.
      let attemptCount = 0;
      await page.route('**/api/auth/login', async (route) => {
        attemptCount++;
        if (attemptCount > 5) {
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            headers: { 'Retry-After': '900' },
            body: JSON.stringify({ success: false, error: 'Too many attempts. Please try again later.' }),
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: 'Invalid email or password' }),
          });
        }
      });

      await page.goto('/login');

      // Five bad attempts — each returns 401 and shows the standard wrong-password error
      for (let i = 0; i < 5; i++) {
        await page.fill('#email', 'ratelimit-e2e@example.com');
        await page.fill('#password', 'WrongPass1!');
        await page.click('button[type="submit"]');
        await expect(page.getByText('Invalid email or password')).toBeVisible();
      }

      // Sixth attempt — returns 429, UI shows rate-limit message
      await page.fill('#email', 'ratelimit-e2e@example.com');
      await page.fill('#password', 'WrongPass1!');
      await page.click('button[type="submit"]');

      await expect(page.getByText('Too many attempts. Please try again later.')).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Signup validation', () => {
    test('invalid email format triggers client-side error, form does not submit', async ({ page }) => {
      await page.goto('/signup');

      await page.fill('#email', 'not-an-email');
      await page.fill('#password', 'ValidPass1!');
      await page.click('button[type="submit"]');

      await expect(page.getByText('Invalid email address')).toBeVisible();
      await expect(page).toHaveURL(/\/signup/);
    });

    test('duplicate email shows "Email already registered" error', async ({ page }) => {
      const email = `edge-dup-${RUN_ID}@test.com`;
      const password = 'ValidPass1!';

      await page.request.post('/api/auth/signup', { data: { email, password } });

      try {
        await page.goto('/signup');
        await page.fill('#email', email);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');

        await expect(page.getByText('Email already registered')).toBeVisible();
        await expect(page).toHaveURL(/\/signup/);
      } finally {
        await deleteUser(page, email);
      }
    });

    test('password shorter than 8 chars triggers client-side error', async ({ page }) => {
      await page.goto('/signup');

      await page.fill('#email', 'valid@example.com');
      await page.fill('#password', 'Sh0!');
      await page.click('button[type="submit"]');

      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
      await expect(page).toHaveURL(/\/signup/);
    });
  });

  test.describe('Session handling', () => {
    test('invalid session cookie redirects to login when accessing dashboard', async ({ page }) => {
      // Set a cookie with a malformed JWT — middleware's signature verification rejects it
      await page.context().addCookies([{
        name: 'meme_radar_session',
        value: 'invalid.jwt.token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      }]);

      await page.goto('/dashboard');

      await expect(page).toHaveURL(/\/login/);
    });

    test('logout clears session — dashboard redirects to login afterwards', async ({ page }) => {
      const email = `edge-logout-${RUN_ID}@test.com`;
      const password = 'ValidPass1!';

      await page.goto('/signup');
      await page.fill('#email', email);
      await page.fill('#password', password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });

      try {
        // Click the logout button
        await page.getByRole('button', { name: 'Log Out' }).click();
        await page.waitForURL(/\/(login|$)/, { timeout: 5000 });

        // Accessing /dashboard now should redirect back to login
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login/);
      } finally {
        await deleteUser(page, email);
      }
    });
  });

  test('double-submit — button is disabled during loading, creating only one user', async ({ page }) => {
    const email = `edge-double-${RUN_ID}@test.com`;
    const password = 'ValidPass1!';

    await page.goto('/signup');
    await page.fill('#email', email);
    await page.fill('#password', password);

    const submitButton = page.locator('button[type="submit"]');

    // Click submit once — then immediately try to click again with force.
    // The button gets disabled={isLoading} after the first click so a second
    // real click is prevented. The { force: true } dispatches the event but a
    // disabled HTML submit button does not trigger form submission.
    await submitButton.click();
    await submitButton.click({ force: true });

    // Wait for success redirect
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    try {
      // Confirm only one user was created — a second signup with the same email
      // must return 409 Conflict
      const duplicate = await page.request.post('/api/auth/signup', { data: { email, password } });
      expect(duplicate.status()).toBe(409);
    } finally {
      await deleteUser(page, email);
    }
  });
});
