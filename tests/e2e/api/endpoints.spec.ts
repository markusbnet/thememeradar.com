import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  const testEmail = `api-test-${Date.now()}@example.com`;
  const testPassword = 'ApiTest123!';
  let authCookie: string;

  test.beforeAll(async ({ request }) => {
    // Create a test user for API tests
    const signupResponse = await request.post('/api/auth/signup', {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(signupResponse.ok()).toBeTruthy();
    const cookies = signupResponse.headers()['set-cookie'];
    if (cookies) {
      authCookie = cookies;
    }
  });

  test.afterAll(async ({ request }) => {
    // Clean up test user
    await request.delete('/api/test/delete-user', {
      data: { email: testEmail },
    });
  });

  test.describe('/api/auth/signup', () => {
    test('should create new user with valid data', async ({ request }) => {
      const uniqueEmail = `signup-test-${Date.now()}@example.com`;

      const response = await request.post('/api/auth/signup', {
        data: {
          email: uniqueEmail,
          password: 'ValidPass123!',
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(uniqueEmail);

      // Cleanup
      await request.delete('/api/test/delete-user', {
        data: { email: uniqueEmail },
      });
    });

    test('should return 400 for missing email', async ({ request }) => {
      const response = await request.post('/api/auth/signup', {
        data: {
          password: 'ValidPass123!',
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.toLowerCase()).toContain('email');
    });

    test('should return 400 for missing password', async ({ request }) => {
      const response = await request.post('/api/auth/signup', {
        data: {
          email: 'test@example.com',
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.toLowerCase()).toContain('password');
    });

    test('should return 400 for invalid email format', async ({ request }) => {
      const response = await request.post('/api/auth/signup', {
        data: {
          email: 'invalid-email',
          password: 'ValidPass123!',
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test('should return 400 for weak password', async ({ request }) => {
      const response = await request.post('/api/auth/signup', {
        data: {
          email: `test-${Date.now()}@example.com`,
          password: 'weak',
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.toLowerCase()).toContain('password');
    });

    test('should return 400 for duplicate email', async ({ request }) => {
      const duplicateEmail = `duplicate-${Date.now()}@example.com`;

      // Create first user
      const first = await request.post('/api/auth/signup', {
        data: {
          email: duplicateEmail,
          password: 'ValidPass123!',
        },
      });
      expect(first.ok()).toBeTruthy();

      // Try to create duplicate
      const second = await request.post('/api/auth/signup', {
        data: {
          email: duplicateEmail,
          password: 'ValidPass123!',
        },
      });

      expect(second.status()).toBe(409); // Conflict status code
      const data = await second.json();
      expect(data.success).toBe(false);
      expect(data.error.toLowerCase()).toMatch(/exist|already|registered/);

      // Cleanup
      await request.delete('/api/test/delete-user', {
        data: { email: duplicateEmail },
      });
    });
  });

  test.describe('/api/auth/login', () => {
    test('should login with valid credentials', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(testEmail);

      // Should set cookie
      const cookies = response.headers()['set-cookie'];
      expect(cookies).toBeTruthy();
    });

    test('should return 401 for invalid email', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'nonexistent@example.com',
          password: 'AnyPass123!',
        },
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test('should return 401 for incorrect password', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: testEmail,
          password: 'WrongPass123!',
        },
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test('should return 400 for missing credentials', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {},
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('/api/auth/logout', () => {
    test('should logout successfully with valid session', async ({ request }) => {
      // First login
      const loginResponse = await request.post('/api/auth/login', {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];

      // Then logout
      const logoutResponse = await request.post('/api/auth/logout', {
        headers: {
          Cookie: cookies || '',
        },
      });

      expect(logoutResponse.ok()).toBeTruthy();
      const data = await logoutResponse.json();
      expect(data.success).toBe(true);
    });

    test('should handle logout without session gracefully', async ({ request }) => {
      const response = await request.post('/api/auth/logout');

      // Should still return success even without session
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('/api/auth/me', () => {
    test('should return user data with valid session', async ({ request }) => {
      // Login first
      const loginResponse = await request.post('/api/auth/login', {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      const cookies = loginResponse.headers()['set-cookie'];

      // Get user data
      const meResponse = await request.get('/api/auth/me', {
        headers: {
          Cookie: cookies || '',
        },
      });

      expect(meResponse.ok()).toBeTruthy();
      const data = await meResponse.json();
      expect(data.success).toBe(true);
      // API returns { success: true, user: { email, userId, ... } }
      expect(data.user.email).toBe(testEmail);
    });

    test('should return 401 without valid session', async ({ request }) => {
      const response = await request.get('/api/auth/me');

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test('should return 401 with invalid session token', async ({ request }) => {
      const response = await request.get('/api/auth/me', {
        headers: {
          Cookie: 'meme_radar_session=invalid-token-123',
        },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('/api/stocks/trending', () => {
    test('should return trending stocks data', async ({ request }) => {
      const response = await request.get('/api/stocks/trending');

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('trending');
      expect(data.data).toHaveProperty('fading');
      expect(data.data).toHaveProperty('timestamp');
    });

    test('should return array for trending stocks', async ({ request }) => {
      const response = await request.get('/api/stocks/trending');
      const data = await response.json();

      expect(Array.isArray(data.data.trending)).toBe(true);
      expect(Array.isArray(data.data.fading)).toBe(true);
    });

    test('should handle empty stock data gracefully', async ({ request }) => {
      const response = await request.get('/api/stocks/trending');

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      // Should return empty arrays if no data
      expect(data.data.trending).toBeDefined();
      expect(data.data.fading).toBeDefined();
    });
  });

  test.describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async ({ request }) => {
      const response = await request.get('/api/nonexistent');
      expect(response.status()).toBe(404);
    });

    test('should handle malformed JSON gracefully', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: 'invalid-json-{',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should reject requests with invalid Content-Type', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: 'email=test@example.com',
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Rate Limiting (if implemented)', () => {
    test.skip('should handle rate limiting on auth endpoints', async ({ request }) => {
      // Make multiple rapid requests
      const requests = Array(20)
        .fill(null)
        .map(() =>
          request.post('/api/auth/login', {
            data: {
              email: 'test@example.com',
              password: 'wrong',
            },
          })
        );

      const responses = await Promise.all(requests);
      const statuses = responses.map(r => r.status());

      // At least one should be rate limited (429)
      expect(statuses.some(s => s === 429)).toBe(true);
    });
  });
});
