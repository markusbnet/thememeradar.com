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

test.describe('Protected Dashboard', () => {
  const testUsers: string[] = [];

  test.afterEach(async ({ baseURL }) => {
    // Clean up all test users created during this test
    for (const email of testUsers) {
      await deleteTestUser(email, baseURL || 'http://localhost:3001');
    }
    testUsers.length = 0; // Clear the array
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display dashboard when authenticated', async ({ page }) => {
    // First, create a user and log in
    const testEmail = `testdash-${Date.now()}@example.com`;
    const testPassword = 'ValidPass123!';
    testUsers.push(testEmail); // Track for cleanup

    // Sign up
    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Check dashboard elements
    await expect(page).toHaveTitle(/Dashboard/i);
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible();
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
    await expect(page.getByText(testEmail)).toBeVisible();
  });

  test('should display logout button when authenticated', async ({ page }) => {
    // Create user and log in
    const testEmail = `testlogout-${Date.now()}@example.com`;
    const testPassword = 'ValidPass123!';
    testUsers.push(testEmail); // Track for cleanup

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Check logout button is visible
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
  });

  test('should logout and redirect to login', async ({ page }) => {
    // Create user and log in
    const testEmail = `testlogout2-${Date.now()}@example.com`;
    const testPassword = 'ValidPass123!';
    testUsers.push(testEmail); // Track for cleanup

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Click logout button
    await page.getByRole('button', { name: /log out/i }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);

    // Try to access dashboard again
    await page.goto('/dashboard');

    // Should still redirect to login (session cleared)
    await expect(page).toHaveURL(/\/login/);
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    // Create user and log in
    const testEmail = `testpersist-${Date.now()}@example.com`;
    const testPassword = 'ValidPass123!';
    testUsers.push(testEmail); // Track for cleanup

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Reload the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(testEmail)).toBeVisible();
  });

  test('should show user email on dashboard', async ({ page }) => {
    // Create user and log in
    const testEmail = `testemail-${Date.now()}@example.com`;
    const testPassword = 'ValidPass123!';
    testUsers.push(testEmail); // Track for cleanup

    await page.goto('/signup');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Check user email is displayed
    await expect(page.getByText(testEmail)).toBeVisible();
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
  });
});
