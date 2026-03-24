import { POST } from '@/app/api/auth/logout/route';

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
});
