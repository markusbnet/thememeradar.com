import { GET } from '@/app/api/auth/me/route';
import { createUser, deleteUserByEmail } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import jwt from 'jsonwebtoken';

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

  it('should not include passwordHash as a key in the response user object', async () => {
    const response = await GET(createMeRequest(validToken) as any);
    const data = await response.json();

    // Verify the key is completely absent, not just undefined
    expect(Object.keys(data.user)).not.toContain('passwordHash');
    // Also confirm only the expected safe fields are present
    expect(Object.keys(data.user).sort()).toEqual(
      ['createdAt', 'email', 'lastLoginAt', 'userId'].sort()
    );
  });

  it('should return 401 with an expired token', async () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set in test environment');

    // Sign a token that expired 1 second in the past
    const expiredToken = jwt.sign({ userId }, secret, { expiresIn: -1 });

    const response = await GET(createMeRequest(expiredToken) as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/invalid or expired token/i);
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

  it('should return 401 when user no longer exists in the database', async () => {
    // Generate a valid JWT for a userId that was never inserted into the DB
    const deletedUserId = 'non-existent-user-id-00000000';
    const tokenForDeletedUser = generateToken(deletedUserId);

    const response = await GET(createMeRequest(tokenForDeletedUser) as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/user not found/i);
  });
});
