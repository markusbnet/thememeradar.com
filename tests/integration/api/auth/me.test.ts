import { GET } from '@/app/api/auth/me/route';
import { createUser, deleteUserByEmail } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';

// Use a wrapper to simulate NextRequest with cookies
function createMeRequest(token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Cookie'] = `meme_radar_session=${token}`;
  }
  const req = new Request('http://localhost:3000/api/auth/me', { headers });

  // Polyfill cookies.get() for NextRequest compatibility
  (req as any).cookies = {
    get: (name: string) => {
      const cookieStr = req.headers.get('Cookie') || '';
      const match = cookieStr.match(new RegExp(`${name}=([^;]+)`));
      return match ? { value: match[1] } : undefined;
    },
  };

  return req;
}

describe('GET /api/auth/me', () => {
  const testEmail = `me-test-${Date.now()}@example.com`;
  let userId: string;
  let validToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('TestPass123!');
    const user = await createUser({ email: testEmail, passwordHash });
    userId = user.userId;
    validToken = generateToken(userId);
  });

  afterAll(async () => {
    await deleteUserByEmail(testEmail);
  });

  it('should return user data with valid token', async () => {
    const response = await GET(createMeRequest(validToken) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.userId).toBe(userId);
    expect(data.user.email).toBe(testEmail.toLowerCase());
  });

  it('should not return passwordHash', async () => {
    const response = await GET(createMeRequest(validToken) as any);
    const data = await response.json();

    expect(data.user.passwordHash).toBeUndefined();
  });

  it('should return 401 without cookie', async () => {
    const response = await GET(createMeRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('should return 401 with invalid token', async () => {
    const response = await GET(createMeRequest('invalid-fake-token') as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});
