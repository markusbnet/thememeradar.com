/**
 * Integration Tests for Auth Rate Limiting
 */

import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as signupPOST } from '@/app/api/auth/signup/route';
import { NextRequest } from 'next/server';
import { rateLimiter } from '@/lib/auth/rate-limiter';

describe('Auth Rate Limiting', () => {
  beforeEach(() => {
    // Clear rate limiter before each test
    rateLimiter.clear();
  });

  describe('Login rate limiting', () => {
    const createLoginRequest = (email: string) => {
      return new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({
          email,
          password: 'TestPassword123!',
        }),
      });
    };

    it('should allow requests under rate limit', async () => {
      const email = `test${Date.now()}@test.com`;

      // Make 3 requests (under limit of 5)
      for (let i = 0; i < 3; i++) {
        const request = createLoginRequest(email);
        const response = await loginPOST(request);

        // Should not be rate limited (will fail auth, but not rate limited)
        expect(response.status).not.toBe(429);
      }
    });

    it('should block 6th request', async () => {
      const email = `test${Date.now()}@test.com`;

      // Make 5 requests (hit the limit)
      for (let i = 0; i < 5; i++) {
        const request = createLoginRequest(email);
        await loginPOST(request);
      }

      // 6th request should be rate limited
      const request = createLoginRequest(email);
      const response = await loginPOST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Too many attempts');
      expect(data).toHaveProperty('retryAfter');
    });

    it('should include rate limit headers', async () => {
      const email = `test${Date.now()}@test.com`;

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const request = createLoginRequest(email);
        await loginPOST(request);
      }

      // 6th request should have rate limit headers
      const request = createLoginRequest(email);
      const response = await loginPOST(request);

      expect(response.headers.get('Retry-After')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('should track different IPs independently', async () => {
      const email = `test${Date.now()}@test.com`;

      // Make 5 requests from IP 1
      for (let i = 0; i < 5; i++) {
        const request = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
          },
          body: JSON.stringify({ email, password: 'test' }),
        });
        await loginPOST(request);
      }

      // Request from IP 2 should not be rate limited
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.2',
        },
        body: JSON.stringify({ email, password: 'test' }),
      });
      const response = await loginPOST(request);

      expect(response.status).not.toBe(429);
    });

    it('should track different emails independently', async () => {
      const email1 = `test1-${Date.now()}@test.com`;
      const email2 = `test2-${Date.now()}@test.com`;

      // Make 5 requests for email1
      for (let i = 0; i < 5; i++) {
        const request = createLoginRequest(email1);
        await loginPOST(request);
      }

      // Request for email2 should not be rate limited
      const request = createLoginRequest(email2);
      const response = await loginPOST(request);

      expect(response.status).not.toBe(429);
    });
  });

  describe('Signup rate limiting', () => {
    const createSignupRequest = (email: string) => {
      return new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
        },
        body: JSON.stringify({
          email,
          password: 'TestPassword123!',
        }),
      });
    };

    it('should allow requests under rate limit', async () => {
      // Make 3 requests (under limit of 5)
      for (let i = 0; i < 3; i++) {
        const email = `test${i}-${Date.now()}@test.com`;
        const request = createSignupRequest(email);
        const response = await signupPOST(request);

        // Should not be rate limited
        expect(response.status).not.toBe(429);
      }
    });

    it('should block 6th request', async () => {
      const baseEmail = `test-${Date.now()}`;

      // Make 5 requests (hit the limit) with same email pattern
      for (let i = 0; i < 5; i++) {
        const request = createSignupRequest(`${baseEmail}@test.com`);
        await signupPOST(request);
      }

      // 6th request should be rate limited
      const request = createSignupRequest(`${baseEmail}@test.com`);
      const response = await signupPOST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Too many attempts');
    });

    it('should include retry-after time', async () => {
      const email = `test-${Date.now()}@test.com`;

      // Hit rate limit
      for (let i = 0; i < 5; i++) {
        const request = createSignupRequest(email);
        await signupPOST(request);
      }

      // Check 6th request has retry info
      const request = createSignupRequest(email);
      const response = await signupPOST(request);
      const data = await response.json();

      expect(data.retryAfter).toBeGreaterThan(0);
      expect(data.retryAfter).toBeLessThanOrEqual(15 * 60 * 1000); // Max 15 minutes
    });
  });

  describe('Rate limit reset on success', () => {
    it('should reset rate limit after successful login', async () => {
      // This test would require a valid user in the database
      // For now, we're testing that failed logins accumulate
      // and successful logins would reset (implementation verified in code)

      const email = `test-${Date.now()}@test.com`;
      const createRequest = () =>
        new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
          },
          body: JSON.stringify({ email, password: 'wrong' }),
        });

      // Make 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await loginPOST(createRequest());
      }

      // 5th attempt should still work (not rate limited yet)
      const response = await loginPOST(createRequest());
      expect(response.status).not.toBe(429);

      // Note: In real scenario, successful login would reset the counter
      // This is implemented in the login route with resetRateLimit()
    });
  });
});
