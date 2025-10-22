import { POST } from '@/app/api/auth/login/route';
import { createUser } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth/password';
import { verifyToken } from '@/lib/auth/jwt';

describe('POST /api/auth/login', () => {
  const testEmail = `logintest-${Date.now()}@example.com`;
  const testPassword = 'ValidPass123!';

  // Helper to create request
  const createRequest = (body: any) => {
    return new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  // Create test user before tests
  let testUser: any;
  beforeAll(async () => {
    const passwordHash = await hashPassword(testPassword);
    testUser = await createUser({
      email: testEmail,
      passwordHash,
    });
  });

  describe('Success Cases', () => {
    it('should authenticate user with correct email + password', async () => {
      const request = createRequest({
        email: testEmail,
        password: testPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(testEmail);
      expect(data.data.user.userId).toBe(testUser.userId);
      expect(data.data.token).toBeDefined();
    });

    it('should return JWT token in response', async () => {
      const request = createRequest({
        email: testEmail,
        password: testPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      const token = data.data.token;
      expect(token).toBeDefined();

      // Verify token is valid
      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(testUser.userId);
    });

    it('should set httpOnly cookie with JWT token', async () => {
      const request = createRequest({
        email: testEmail,
        password: testPassword,
      });

      const response = await POST(request);
      const setCookieHeader = response.headers.get('set-cookie');

      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('meme_radar_session=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Path=/');
    });

    it('should accept email case-insensitively', async () => {
      const request = createRequest({
        email: testEmail.toUpperCase(), // LOGINTEST@EXAMPLE.COM
        password: testPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(testEmail.toLowerCase());
    });

    it('should not return passwordHash in response', async () => {
      const request = createRequest({
        email: testEmail,
        password: testPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.user.passwordHash).toBeUndefined();
    });

    it('should trim whitespace from email', async () => {
      const request = createRequest({
        email: `  ${testEmail}  `,
        password: testPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.user.email).toBe(testEmail);
    });
  });

  describe('Error Cases', () => {
    it('should reject incorrect password (401 Unauthorized)', async () => {
      const request = createRequest({
        email: testEmail,
        password: 'WrongPassword123!',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid email or password');
    });

    it('should reject non-existent email (401 Unauthorized)', async () => {
      const request = createRequest({
        email: 'nonexistent@example.com',
        password: testPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid email or password');
    });

    it('should reject missing email field (400 Bad Request)', async () => {
      const request = createRequest({
        password: testPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Email is required');
    });

    it('should reject missing password field (400 Bad Request)', async () => {
      const request = createRequest({
        email: testEmail,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Password is required');
    });

    it('should reject empty email (400 Bad Request)', async () => {
      const request = createRequest({
        email: '',
        password: testPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should reject empty password (400 Bad Request)', async () => {
      const request = createRequest({
        email: testEmail,
        password: '',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });
});
