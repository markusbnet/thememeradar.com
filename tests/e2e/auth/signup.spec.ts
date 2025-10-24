import { test, expect } from '@playwright/test';

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

test.describe('Signup Page', () => {
  const testUsers: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Navigate to signup page before each test
    await page.goto('/signup');
  });

  test.afterEach(async ({ baseURL }) => {
    // Clean up all test users created during this test
    for (const email of testUsers) {
      await deleteTestUser(email, baseURL || 'http://localhost:3001');
    }
    testUsers.length = 0; // Clear the array
  });

  test('should display signup form with all required elements', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Sign Up/i);

    // Check form elements are present
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();

    // Check link to login page
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
  });

  test('should successfully sign up with valid email and password', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const validPassword = 'ValidPass123!';
    testUsers.push(uniqueEmail); // Track for cleanup

    // Fill in the form
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(validPassword);

    // Submit the form
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Should show success or dashboard content
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    // Fill in invalid email
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).fill('ValidPass123!');

    // Submit the form
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid email/i)).toBeVisible();

    // Should stay on signup page
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should show error for weak password', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    // Fill in weak password
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill('weak');

    // Submit the form
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show error message about password requirements
    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();

    // Should stay on signup page
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should show error for duplicate email', async ({ page }) => {
    const duplicateEmail = `duplicate-${Date.now()}@example.com`;
    const validPassword = 'ValidPass123!';
    testUsers.push(duplicateEmail); // Track for cleanup

    // First signup - should succeed
    await page.getByLabel(/email/i).fill(duplicateEmail);
    await page.getByLabel(/password/i).fill(validPassword);
    await page.getByRole('button', { name: /sign up/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate back to signup page
    await page.goto('/signup');

    // Try to sign up again with same email
    await page.getByLabel(/email/i).fill(duplicateEmail);
    await page.getByLabel(/password/i).fill(validPassword);
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show error about duplicate email
    await expect(page.getByText(/email already registered/i)).toBeVisible();

    // Should stay on signup page
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should validate empty email field', async ({ page }) => {
    // Fill only password
    await page.getByLabel(/password/i).fill('ValidPass123!');

    // Submit the form
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show error message
    await expect(page.getByText(/email is required/i)).toBeVisible();

    // Should stay on signup page
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should validate empty password field', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    // Fill only email
    await page.getByLabel(/email/i).fill(uniqueEmail);

    // Submit the form
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show error message
    await expect(page.getByText(/password is required/i)).toBeVisible();

    // Should stay on signup page
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);

    // Password should initially be hidden (type="password")
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the show/hide toggle button
    await page.getByRole('button', { name: /toggle visibility/i }).click();

    // Password should now be visible (type="text")
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click the toggle again
    await page.getByRole('button', { name: /toggle visibility/i }).click();

    // Password should be hidden again
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate to login page when clicking login link', async ({ page }) => {
    // Click the login link
    await page.getByRole('link', { name: /log in/i }).click();

    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should trim whitespace from email', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const validPassword = 'ValidPass123!';
    testUsers.push(uniqueEmail); // Track for cleanup

    // Fill email with extra whitespace
    await page.getByLabel(/email/i).fill(`  ${uniqueEmail}  `);
    await page.getByLabel(/password/i).fill(validPassword);

    // Submit the form
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should successfully sign up and redirect
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should handle form submission with Enter key', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const validPassword = 'ValidPass123!';
    testUsers.push(uniqueEmail); // Track for cleanup

    // Fill in the form
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill(validPassword);

    // Press Enter instead of clicking button
    await page.getByLabel(/password/i).press('Enter');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
