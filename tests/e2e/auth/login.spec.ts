import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/login');
  });

  test('should display login form with all required elements', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Log In/i);

    // Check form elements are present
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();

    // Check signup link is present
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('should successfully log in with valid credentials', async ({ page }) => {
    // First, create a test user via signup
    const testEmail = `testlogin-${Date.now()}@example.com`;
    const testPassword = 'ValidPass123!';

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Now log out (by navigating to login page)
    await page.goto('/login');

    // Fill in the login form
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);

    // Submit the form
    await page.getByRole('button', { name: /log in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    // Fill in invalid email
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).fill('ValidPass123!');

    // Submit the form
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid email/i)).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for non-existent user', async ({ page }) => {
    // Use an email that doesn't exist
    const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;

    await page.getByLabel(/email/i).fill(nonExistentEmail);
    await page.getByLabel(/password/i).fill('ValidPass123!');

    // Submit the form
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for incorrect password', async ({ page }) => {
    // First, create a test user
    const testEmail = `testloginwrong-${Date.now()}@example.com`;
    const correctPassword = 'ValidPass123!';
    const wrongPassword = 'WrongPass123!';

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(correctPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to login
    await page.goto('/login');

    // Try to login with wrong password
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(wrongPassword);
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should validate empty email field', async ({ page }) => {
    // Leave email empty
    await page.getByLabel(/password/i).fill('ValidPass123!');

    // Submit the form
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show error message
    await expect(page.getByText(/email is required/i)).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should validate empty password field', async ({ page }) => {
    // Leave password empty
    await page.getByLabel(/email/i).fill('test@example.com');

    // Submit the form
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show error message
    await expect(page.getByText(/password is required/i)).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
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

  test('should navigate to signup page when clicking signup link', async ({ page }) => {
    // Click the signup link
    await page.getByRole('link', { name: /sign up/i }).click();

    // Should navigate to signup page
    await expect(page).toHaveURL(/\/signup/);
  });

  test('should trim whitespace from email', async ({ page }) => {
    // Create a test user
    const testEmail = `testtrim-${Date.now()}@example.com`;
    const testPassword = 'ValidPass123!';

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to login
    await page.goto('/login');

    // Fill email with extra whitespace
    await page.getByLabel(/email/i).fill(`  ${testEmail}  `);
    await page.getByLabel(/password/i).fill(testPassword);

    // Submit the form
    await page.getByRole('button', { name: /log in/i }).click();

    // Should successfully log in despite whitespace
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should handle form submission with Enter key', async ({ page }) => {
    // Create a test user
    const testEmail = `testenter-${Date.now()}@example.com`;
    const testPassword = 'ValidPass123!';

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to login
    await page.goto('/login');

    // Fill in the form
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);

    // Press Enter instead of clicking button
    await page.getByLabel(/password/i).press('Enter');

    // Should successfully log in
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
