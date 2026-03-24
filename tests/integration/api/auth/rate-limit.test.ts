import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as signupPOST } from '@/app/api/auth/signup/route';
import { authRateLimiter } from '@/lib/rate-limit';

// Rate limiter is reset globally in tests/setup.ts beforeEach

function createLoginRequest(body: Record<string, string>, ip = '127.0.0.1') {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

function createSignupRequest(body: Record<string, string>, ip = '127.0.0.1') {
  return new Request('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('Rate limiting on /api/auth/login', () => {
  it('should return 429 after 5 failed login attempts', async () => {
    const ip = `login-test-${Date.now()}`;

    // Make 5 requests (all allowed)
    for (let i = 0; i < 5; i++) {
      const req = createLoginRequest(
        { email: 'fake@example.com', password: 'wrong' + i },
        ip
      );
      const res = await loginPOST(req as any);
      expect(res.status).not.toBe(429);
    }

    // 6th request should be rate limited
    const req = createLoginRequest(
      { email: 'fake@example.com', password: 'wrong6' },
      ip
    );
    const res = await loginPOST(req as any);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/too many attempts/i);
  });

  it('should include Retry-After header when rate limited', async () => {
    const ip = `retry-after-${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      const req = createLoginRequest(
        { email: 'fake@example.com', password: 'wrong' + i },
        ip
      );
      await loginPOST(req as any);
    }

    const req = createLoginRequest(
      { email: 'fake@example.com', password: 'wrong6' },
      ip
    );
    const res = await loginPOST(req as any);

    const retryAfter = res.headers.get('Retry-After');
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it('should track different IPs independently', async () => {
    const ip1 = `ip1-${Date.now()}`;
    const ip2 = `ip2-${Date.now()}`;

    // Exhaust rate limit for ip1
    for (let i = 0; i < 5; i++) {
      const req = createLoginRequest({ email: 'fake@example.com', password: 'w' }, ip1);
      await loginPOST(req as any);
    }

    // ip2 should still work
    const req = createLoginRequest({ email: 'fake@example.com', password: 'w' }, ip2);
    const res = await loginPOST(req as any);
    expect(res.status).not.toBe(429);
  });
});

describe('Rate limiting on /api/auth/signup', () => {
  it('should return 429 after 5 signup attempts', async () => {
    const ip = `signup-test-${Date.now()}`;

    // Make 5 requests (all allowed)
    for (let i = 0; i < 5; i++) {
      const req = createSignupRequest(
        { email: `test${i}@example.com`, password: 'short' },
        ip
      );
      const res = await signupPOST(req as any);
      expect(res.status).not.toBe(429);
    }

    // 6th request should be rate limited
    const req = createSignupRequest(
      { email: 'test6@example.com', password: 'ValidPass123!' },
      ip
    );
    const res = await signupPOST(req as any);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/too many attempts/i);
  });
});
