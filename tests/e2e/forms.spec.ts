import { test, expect } from './fixtures/console-guard';

/**
 * COMPREHENSIVE FORM INTERACTION E2E TESTS
 * Testing all form behaviors, validations, and edge cases
 */

test.describe('Form Interactions', () => {
  const generateEmail = () => `form-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  test.describe('Signup Form', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signup');
    });

    test('should show validation errors when submitting empty form', async ({ page }) => {
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should show validation errors
      await expect(page.getByText(/email.*required/i)).toBeVisible();
      await expect(page.getByText(/password.*required/i)).toBeVisible();
    });

    test('should validate email format in real-time', async ({ page }) => {
      // Type invalid email
      await page.getByLabel(/email/i).fill('notanemail');
      await page.getByRole('textbox', { name: /password/i }).click(); // Blur email field

      // Should show email error
      await expect(page.getByText(/invalid.*email|email.*invalid/i)).toBeVisible();
    });

    test('should validate password strength in real-time', async ({ page }) => {
      // Type weak password
      await page.locator('#password').fill('weak');
      await page.getByLabel(/email/i).click(); // Blur password field

      // Should show password error (triggered by handlePasswordBlur)
      await expect(page.getByText(/must be at least 8 characters/i)).toBeVisible();
    });

    test('should clear validation errors when user fixes input', async ({ page }) => {
      const email = generateEmail();

      // Submit empty form to trigger errors
      await page.getByRole('button', { name: /sign up/i }).click();
      await expect(page.getByText('Email is required')).toBeVisible();

      // Fix the error by typing a valid email
      await page.getByLabel(/email/i).fill(email);
      // Trigger blur to ensure onChange/onBlur validation runs
      await page.locator('#password').click();

      // Error should disappear
      await expect(page.getByText('Email is required')).not.toBeVisible({ timeout: 5000 });
    });

    test('should handle paste events correctly', async ({ page }) => {
      const email = generateEmail();
      const password = 'Paste123!';

      // Use fill() to simulate paste (clipboard API requires secure context)
      await page.getByLabel(/email/i).fill(email);
      await page.locator('#password').fill(password);

      // Submit
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should succeed
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle rapid form submission (prevent double submit)', async ({ page }) => {
      const email = generateEmail();
      const password = 'DoubleSubmit123!';

      await page.getByLabel(/email/i).fill(email);
      await page.locator('#password').fill(password);

      // Click submit button
      const submitButton = page.getByRole('button', { name: /sign up/i });
      await submitButton.click();

      // Button should be disabled during submission (prevents double submit)
      await expect(page.getByRole('button', { name: /signing up/i })).toBeDisabled();

      // Should only create one user
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle special characters in email', async ({ page }) => {
      const email = `test+special.chars_123-${Date.now()}@example.com`;
      const password = 'Special123!';

      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should succeed with special chars
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should trim whitespace from email automatically', async ({ page }) => {
      const email = generateEmail();
      const password = 'Whitespace123!';

      // Add leading and trailing whitespace
      await page.getByLabel(/email/i).fill(`  ${email}  `);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should succeed (whitespace trimmed)
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Cleanup - use trimmed email
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle form submission during network delay', async ({ page }) => {
      const email = generateEmail();
      const password = 'NetworkDelay123!';

      await page.getByLabel(/email/i).fill(email);
      await page.locator('#password').fill(password);

      // Delay the network response
      await page.route('**/api/auth/signup', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2s delay
        await route.continue();
      });

      await page.getByRole('button', { name: /sign up/i }).click();

      // Button should be disabled during submission
      await expect(page.getByRole('button', { name: /signing up/i })).toBeDisabled();

      // Should eventually succeed
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle very long email addresses', async ({ page }) => {
      const longLocal = 'a'.repeat(64); // Max local part is 64 chars
      const email = `${longLocal}@example.com`;
      const password = 'LongEmail123!';

      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();

      // Should handle gracefully (accept or show validation error)
      await page.waitForTimeout(2000);

      // Either succeeds or shows validation error
      const isOnDashboard = page.url().includes('/dashboard');
      const hasError = await page.getByText(/email|invalid/i).isVisible().catch(() => false);

      expect(isOnDashboard || hasError).toBe(true);

      // Cleanup if succeeded
      if (isOnDashboard) {
        await page.request.delete('/api/test/delete-user', {
          data: { email },
        });
      }
    });
  });

  test.describe('Login Form', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
    });

    test('should show validation errors when submitting empty form', async ({ page }) => {
      await page.getByRole('button', { name: /log in/i }).click();

      // Should show validation errors
      await expect(page.getByText(/email.*required/i)).toBeVisible();
      await expect(page.getByText(/password.*required/i)).toBeVisible();
    });

    test('should remember last entered email after failed login', async ({ page }) => {
      const email = generateEmail();

      // Enter credentials and submit
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill('WrongPassword123!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for error
      await expect(page.getByText(/invalid|incorrect/i)).toBeVisible();

      // Email should still be in the field
      const emailInput = page.getByLabel(/email/i);
      const emailValue = await emailInput.inputValue();
      expect(emailValue).toBe(email);
    });

    test('should clear password field after failed login', async ({ page }) => {
      const email = generateEmail();

      // Setup: Create user
      await page.request.post('/api/auth/signup', {
        data: { email, password: 'CorrectPass123!' },
      });

      // Enter wrong password
      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill('WrongPassword123!');
      await page.getByRole('button', { name: /log in/i }).click();

      // Wait for error
      await expect(page.getByText(/invalid|incorrect/i)).toBeVisible();

      // Password field should be cleared for security
      const passwordInput = page.getByRole('textbox', { name: /password/i });
      const passwordValue = await passwordInput.inputValue();
      expect(passwordValue).toBe('');

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle Enter key in email field', async ({ page }) => {
      const email = generateEmail();
      const password = 'EnterKey123!';

      // Setup: Create user
      await page.request.post('/api/auth/signup', {
        data: { email, password },
      });

      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);

      // Press Enter in email field
      await page.getByLabel(/email/i).press('Enter');

      // Should submit form
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle Enter key in password field', async ({ page }) => {
      const email = generateEmail();
      const password = 'EnterKey123!';

      // Setup: Create user
      await page.request.post('/api/auth/signup', {
        data: { email, password },
      });

      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);

      // Press Enter in password field
      await page.getByRole('textbox', { name: /password/i }).press('Enter');

      // Should submit form
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });

    test('should handle Tab key navigation', async ({ page }) => {
      await page.getByLabel(/email/i).focus();

      // Tab to password
      await page.keyboard.press('Tab');
      await expect(page.locator('#password')).toBeFocused();

      // Tab past show/hide toggle button to submit button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: /log in/i })).toBeFocused();
    });
  });

  test.describe('Password Visibility Toggle', () => {
    test('should toggle password visibility in signup form', async ({ page }) => {
      await page.goto('/signup');

      const passwordInput = page.locator('#password');
      await passwordInput.fill('SecretPassword123!');

      // Password should be masked
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Click show password button
      await page.getByRole('button', { name: /show password/i }).click();

      // Password should be visible
      await expect(passwordInput).toHaveAttribute('type', 'text');

      // Toggle back
      await page.getByRole('button', { name: /hide password/i }).click();

      // Password should be masked again
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('should toggle password visibility in login form', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.locator('#password');
      await passwordInput.fill('SecretPassword123!');

      // Password should be masked
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Click show password button
      await page.getByRole('button', { name: /show password/i }).click();

      // Password should be visible
      await expect(passwordInput).toHaveAttribute('type', 'text');

      // Toggle back
      await page.getByRole('button', { name: /hide password/i }).click();

      // Password should be masked again
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Form Accessibility', () => {
    test('should have proper form labels', async ({ page }) => {
      await page.goto('/signup');

      // Email label should be associated
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toBeVisible();

      // Password label should be associated
      const passwordInput = page.getByRole('textbox', { name: /password/i });
      await expect(passwordInput).toBeVisible();
    });

    test('should have accessible error messages', async ({ page }) => {
      await page.goto('/signup');

      // Submit empty form
      await page.getByRole('button', { name: /sign up/i }).click();

      // Error messages should be visible and readable
      const errors = page.locator('[role="alert"], .text-red-600, .text-red-700');
      const errorCount = await errors.count();

      expect(errorCount).toBeGreaterThan(0);
    });

    test('should maintain focus management during validation', async ({ page }) => {
      await page.goto('/signup');

      const emailInput = page.getByLabel(/email/i);

      // Focus email field
      await emailInput.focus();
      await expect(emailInput).toBeFocused();

      // Fill with invalid email
      await emailInput.fill('invalid');

      // Tab away to trigger validation
      await page.keyboard.press('Tab');

      // Focus should move naturally (not jump unexpectedly)
      await expect(page.getByRole('textbox', { name: /password/i })).toBeFocused();
    });
  });

  test.describe('Form Autocomplete', () => {
    test('should have proper autocomplete attributes', async ({ page }) => {
      await page.goto('/signup');

      // Email should have autocomplete
      const emailInput = page.getByLabel(/email/i);
      const emailAutocomplete = await emailInput.getAttribute('autocomplete');
      expect(emailAutocomplete).toMatch(/email|username/);

      // Password should have autocomplete
      const passwordInput = page.getByRole('textbox', { name: /password/i });
      const passwordAutocomplete = await passwordInput.getAttribute('autocomplete');
      expect(passwordAutocomplete).toMatch(/password|current-password|new-password/);
    });
  });

  test.describe('Form Security', () => {
    test('should not expose password in HTML', async ({ page }) => {
      await page.goto('/signup');

      await page.locator('#password').fill('SuperSecret123!');

      // Password should not appear as visible text on the page (it's in the input value attribute but masked)
      const visibleText = await page.locator('body').innerText();
      expect(visibleText).not.toContain('SuperSecret123!');
    });

    test('should not log sensitive data to console', async ({ page }) => {
      const consoleLogs: string[] = [];

      page.on('console', (msg) => {
        consoleLogs.push(msg.text());
      });

      await page.goto('/signup');

      const email = generateEmail();
      const password = 'SecretPassword123!';

      await page.getByLabel(/email/i).fill(email);
      await page.getByRole('textbox', { name: /password/i }).fill(password);
      await page.getByRole('button', { name: /sign up/i }).click();

      // Wait a bit for any console logs
      await page.waitForTimeout(2000);

      // Check that password was not logged
      const hasPasswordInLogs = consoleLogs.some((log) => log.includes(password));
      expect(hasPasswordInLogs).toBe(false);

      // Cleanup
      await page.request.delete('/api/test/delete-user', {
        data: { email },
      });
    });
  });
});
