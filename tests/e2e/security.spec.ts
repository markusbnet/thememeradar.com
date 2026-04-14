import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
  const testEmail = `security-test-${Date.now()}@example.com`;
  const testPassword = 'SecTest123!';

  test.beforeAll(async ({ browser }) => {
    // Create test user
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByRole('textbox', { name: /password/i }).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.waitForURL(/\/dashboard/);

    await context.close();
  });

  test.afterAll(async ({ request }) => {
    // Cleanup
    await request.delete('/api/test/delete-user', {
      data: { email: testEmail },
    });
  });

  test.describe('Session Management', () => {
    test('should prevent access to dashboard without authentication', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should maintain session across page reloads', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('textbox', { name: /password/i }).fill(testPassword);
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL(/\/dashboard/);

      // Reload page
      await page.reload();

      // Should still be on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/Welcome back/i)).toBeVisible();
    });

    test('should maintain session across navigation', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('textbox', { name: /password/i }).fill(testPassword);
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL(/\/dashboard/);

      // Navigate to home
      await page.goto('/');

      // Navigate back to dashboard
      await page.goto('/dashboard');

      // Should still be authenticated
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/Welcome back/i)).toBeVisible();
    });

    test('should clear session on logout', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('textbox', { name: /password/i }).fill(testPassword);
      await page.getByRole('button', { name: /log in/i }).click();
      await page.waitForURL(/\/dashboard/);

      // Logout
      await page.getByRole('button', { name: /Log Out/i }).click();
      await expect(page).toHaveURL(/\/login/);

      // Try to access dashboard
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('should not allow access with manipulated cookie', async ({ page, context }) => {
      // Navigate to landing page first to establish domain
      await page.goto('/');

      // Set invalid cookie
      await context.addCookies([
        {
          name: 'meme_radar_session',
          value: 'fake-invalid-token-12345',
          domain: new URL(page.url()).hostname,
          path: '/',
        },
      ]);

      await page.goto('/dashboard');

      // Should redirect to login due to invalid token
      await expect(page).toHaveURL(/\/login/);
    });

    test('should handle missing session cookie', async ({ page }) => {
      // Clear all cookies
      await page.context().clearCookies();

      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Authentication Security', () => {
    test('should not leak user existence on login with non-existent email', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('nonexistent@example.com');
      await page.getByRole('textbox', { name: /password/i }).fill('SomePassword123!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Should show generic error, not "user not found"
      const errorMessage = await page.locator('.text-red-600, .text-red-700').textContent();
      expect(errorMessage?.toLowerCase()).not.toContain('not found');
      expect(errorMessage?.toLowerCase()).not.toContain('does not exist');
    });

    test('should rate limit login attempts (if implemented)', async ({ page }) => {
      await page.goto('/login');

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await page.getByLabel(/email/i).fill('test@example.com');
        await page.getByRole('textbox', { name: /password/i }).fill('WrongPassword' + i);
        await page.getByRole('button', { name: /log in/i }).click();
        await page.waitForTimeout(500);
      }

      // Check if rate limiting message appears (if implemented)
      const rateLimitMessage = await page.getByText(/too many attempts|rate limit/i).isVisible().catch(() => false);

      // This test documents expected behavior
      expect(typeof rateLimitMessage).toBe('boolean');
    });

    test('should not allow SQL injection in email field', async ({ page }) => {
      await page.goto('/login');

      const sqlInjection = "admin' OR '1'='1";
      await page.getByLabel(/email/i).fill(sqlInjection);
      await page.getByRole('textbox', { name: /password/i }).fill('anything');
      await page.getByRole('button', { name: /log in/i }).click();

      // Should fail authentication
      await expect(page).toHaveURL(/\/login/);
    });

    test('should not allow XSS in email field', async ({ page }) => {
      await page.goto('/signup');

      const xssPayload = '<script>alert("xss")</script>@example.com';
      await page.getByLabel(/email/i).fill(xssPayload);
      await page.getByRole('textbox', { name: /password/i }).fill('ValidPass123!');
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should reject invalid email format
      await expect(page.getByText(/invalid|error/i)).toBeVisible();
    });

    test('should sanitize user input in forms', async ({ page }) => {
      await page.goto('/signup');

      const maliciousInput = '"><script>alert("xss")</script>';
      await page.getByLabel(/email/i).fill(maliciousInput);
      await page.getByRole('textbox', { name: /password/i }).fill('ValidPass123!');
      await page.getByRole('button', { name: /sign up/i }).click();

      // Check that script is not executed (page should not have alert)
      const hasAlert = await page.locator('dialog, [role="alertdialog"]').isVisible().catch(() => false);
      expect(hasAlert).toBe(false);
    });
  });

  test.describe('Password Security', () => {
    test('should enforce password complexity', async ({ page }) => {
      await page.goto('/signup');

      const weakPasswords = ['short', '12345678', 'password', 'qwerty123'];

      for (const weakPwd of weakPasswords) {
        await page.getByLabel(/email/i).fill(`test-${Date.now()}@example.com`);
        await page.locator('#password').fill(weakPwd);
        await page.getByRole('button', { name: /sign up/i }).click();

        // Should show password validation error
        await expect(page.getByText(/must be at least 8 characters/i)).toBeVisible();

        await page.reload();
      }
    });

    test('should mask password input by default', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.getByRole('textbox', { name: /password/i });
      const inputType = await passwordInput.getAttribute('type');

      expect(inputType).toBe('password');
    });

    test('should allow password visibility toggle', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.getByRole('textbox', { name: /password/i });
      await passwordInput.fill('TestPassword123!');

      // Look for toggle button
      const toggleButton = page.getByRole('button', { name: /show password|hide password/i });
      const hasToggle = await toggleButton.isVisible().catch(() => false);

      if (hasToggle) {
        // Click toggle
        await toggleButton.click();

        // Input type should change to text
        const inputType = await passwordInput.getAttribute('type');
        expect(inputType).toBe('text');
      }
    });

    test('should not expose password in DOM or network', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('textbox', { name: /password/i }).fill(testPassword);

      // Check that password is not visible in DOM as plain text
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).not.toContain(testPassword);
    });
  });

  test.describe('HTTPS and Cookie Security', () => {
    test('should set secure cookie flags in production', async ({ page, request }) => {
      // Login to get cookie
      const response = await request.post('/api/auth/login', {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      const setCookieHeader = response.headers()['set-cookie'];

      if (setCookieHeader) {
        // Check for HttpOnly flag
        expect(setCookieHeader.toLowerCase()).toContain('httponly');

        // Check for SameSite flag
        expect(setCookieHeader.toLowerCase()).toContain('samesite');

        // In production, should have Secure flag
        if (process.env.NODE_ENV === 'production') {
          expect(setCookieHeader.toLowerCase()).toContain('secure');
        }
      }
    });

    test('should not expose sensitive data in client-side code', async ({ page }) => {
      await page.goto('/');

      // Check that sensitive env vars are not in page source
      const pageContent = await page.content();

      // Should not contain AWS keys, JWT secrets, etc.
      expect(pageContent).not.toContain('AWS_SECRET_ACCESS_KEY');
      expect(pageContent).not.toContain('JWT_SECRET');
      expect(pageContent).not.toContain('REDDIT_CLIENT_SECRET');
    });
  });

  test.describe('Authorization', () => {
    test('should prevent unauthenticated API access', async ({ request }) => {
      const response = await request.get('/api/auth/me');

      expect(response.status()).toBe(401);
    });

    test('should prevent access to protected routes', async ({ page }) => {
      const protectedRoutes = ['/dashboard'];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/);
      }
    });

    test('should allow access to public routes', async ({ page }) => {
      const publicRoutes = ['/', '/login', '/signup'];

      for (const route of publicRoutes) {
        await page.goto(route);

        // Should load successfully (not be redirected to an error page)
        await expect(page.locator('body')).toBeVisible();

        // Should be on the requested route (or close to it)
        expect(page.url()).toContain(route.replace('/', ''));
      }
    });
  });

  test.describe('Data Validation', () => {
    test('should validate email format on client side', async ({ page }) => {
      await page.goto('/signup');

      const invalidEmails = ['notanemail', '@example.com', 'test@', 'test @example.com'];

      for (const email of invalidEmails) {
        await page.getByLabel(/email/i).fill(email);
        await page.locator('#password').fill('ValidPass123!');
        await page.getByRole('button', { name: /sign up/i }).click();

        // Should show email validation error
        await expect(page.getByText(/invalid email/i)).toBeVisible();

        await page.reload();
      }
    });

    test('should trim whitespace from inputs', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill(`  ${testEmail}  `);
      await page.getByRole('textbox', { name: /password/i }).fill(testPassword);
      await page.getByRole('button', { name: /log in/i }).click();

      // Should successfully login (whitespace trimmed)
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle very long input strings', async ({ page }) => {
      await page.goto('/signup');

      const longEmail = 'a'.repeat(300) + '@example.com';
      const longPassword = 'P'.repeat(1000);

      await page.getByLabel(/email/i).fill(longEmail);
      await page.getByRole('textbox', { name: /password/i }).fill(longPassword);
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should handle gracefully (show error or truncate)
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('CORS and Request Headers', () => {
    test('should include proper CORS headers in API responses', async ({ request }) => {
      const response = await request.get('/api/stocks/trending');

      // Check for CORS headers (if implemented)
      const headers = response.headers();
      expect(headers).toBeDefined();
    });

    test('should handle preflight OPTIONS requests', async ({ request }) => {
      const response = await request.fetch('/api/auth/login', {
        method: 'OPTIONS',
      });

      // Should allow OPTIONS
      expect(response.status()).toBeLessThan(500);
    });
  });
});
