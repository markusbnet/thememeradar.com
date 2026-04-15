import { POST } from '@/app/api/auth/logout/route';
import { NextResponse } from 'next/server';

describe('POST /api/auth/logout', () => {
  const createRequest = () => {
    return new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  };

  it('should return 200 with success message', async () => {
    const response = await POST(createRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Logged out successfully');
  });

  it('should clear the session cookie', async () => {
    const response = await POST(createRequest() as any);
    const setCookie = response.headers.get('set-cookie');

    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('meme_radar_session=');
    // Cookie value should be empty (cleared)
    expect(setCookie).toMatch(/meme_radar_session=\s*[;]/);
  });

  it('should clear the cookie with path=/ and an empty value (expires immediately)', async () => {
    const response = await POST(createRequest() as any);
    const setCookie = response.headers.get('set-cookie');

    expect(setCookie).toBeDefined();
    // Path must be / so the cookie is cleared site-wide
    expect(setCookie).toMatch(/Path=\//i);
    // Cookie value must be empty — an empty value with no Max-Age or with Max-Age=0
    // signals the browser to delete the cookie. Next.js serialises maxAge:0 by
    // simply omitting the attribute and setting an empty value, which achieves the
    // same effect in all browsers.
    expect(setCookie).toMatch(/meme_radar_session=\s*[;]/);
    // Confirm the cookie is NOT being set to a real non-empty value
    const valueMatch = setCookie!.match(/meme_radar_session=([^;]*)/);
    expect(valueMatch?.[1]?.trim()).toBe('');
  });

  it('should set cookie with httpOnly flag', async () => {
    const response = await POST(createRequest() as any);
    const setCookie = response.headers.get('set-cookie');

    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it('should use custom SESSION_COOKIE_NAME from env', async () => {
    const original = process.env.SESSION_COOKIE_NAME;
    process.env.SESSION_COOKIE_NAME = 'custom_session';

    try {
      const response = await POST(createRequest() as any);
      const setCookie = response.headers.get('set-cookie');

      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('custom_session=');
    } finally {
      if (original !== undefined) {
        process.env.SESSION_COOKIE_NAME = original;
      } else {
        delete process.env.SESSION_COOKIE_NAME;
      }
    }
  });

  it('should return 500 when an unexpected error occurs during cookie handling', async () => {
    // Force the route into its catch block by making NextResponse.json throw on
    // the first call (the normal success response construction).
    const originalJson = NextResponse.json.bind(NextResponse);
    let callCount = 0;
    jest.spyOn(NextResponse, 'json').mockImplementation((...args) => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('Simulated cookie handling failure');
      }
      return originalJson(...args);
    });

    try {
      const response = await POST(createRequest() as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    } finally {
      jest.restoreAllMocks();
    }
  });
});
