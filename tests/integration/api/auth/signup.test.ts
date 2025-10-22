import { POST } from '@/app/api/auth/signup/route';
import { getUserByEmail } from '@/lib/db/users';
import { verifyPassword } from '@/lib/auth/password';
import { verifyToken } from '@/lib/auth/jwt';

describe('POST /api/auth/signup', () => {
  const validEmail = 'test@example.com';
  const validPassword = 'ValidPass123!';

  // Helper to create request
  const createRequest = (body: any) => {
    return new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  // Clean up test user after each test
  afterEach(async () => {
    // Note: In a real test, we'd delete the test user from DB
    // For now, we'll use unique emails per test
  });

  describe('Success Cases', () => {
    it('should create new user with valid email + password', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const request = createRequest({
        email: uniqueEmail,
        password: validPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(uniqueEmail.toLowerCase());
      expect(data.data.user.userId).toBeDefined();
      expect(data.data.token).toBeDefined();
    });

    it('should return JWT token in response', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const request = createRequest({
        email: uniqueEmail,
        password: validPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      const token = data.data.token;
      expect(token).toBeDefined();

      // Verify token is valid
      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(data.data.user.userId);
    });

    it('should hash password in database (not plain text)', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const request = createRequest({
        email: uniqueEmail,
        password: validPassword,
      });

      await POST(request);

      // Fetch user from database
      const user = await getUserByEmail(uniqueEmail);
      expect(user).not.toBeNull();
      expect(user!.passwordHash).not.toBe(validPassword);
      expect(user!.passwordHash).toMatch(/^\$2[aby]\$/); // Bcrypt format

      // Verify password can be verified
      const isValid = await verifyPassword(validPassword, user!.passwordHash);
      expect(isValid).toBe(true);
    });

    it('should set httpOnly cookie with JWT token', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const request = createRequest({
        email: uniqueEmail,
        password: validPassword,
      });

      const response = await POST(request);
      const setCookieHeader = response.headers.get('set-cookie');

      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('meme_radar_session=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Path=/');
    });

    it('should trim whitespace from email', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const request = createRequest({
        email: `  ${uniqueEmail}  `,
        password: validPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.user.email).toBe(uniqueEmail.toLowerCase());
    });

    it('should normalize email to lowercase', async () => {
      const uniqueEmail = `TEST-${Date.now()}@EXAMPLE.COM`;
      const request = createRequest({
        email: uniqueEmail,
        password: validPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.user.email).toBe(uniqueEmail.toLowerCase());
    });

    it('should not return passwordHash in response', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const request = createRequest({
        email: uniqueEmail,
        password: validPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('Error Cases', () => {
    it('should reject duplicate email (409 Conflict)', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;

      // Create first user
      const request1 = createRequest({
        email: uniqueEmail,
        password: validPassword,
      });
      await POST(request1);

      // Try to create duplicate
      const request2 = createRequest({
        email: uniqueEmail,
        password: validPassword,
      });
      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(409);
      expect(data2.success).toBe(false);
      expect(data2.error).toContain('Email already registered');
    });

    it('should reject invalid email format (400 Bad Request)', async () => {
      const request = createRequest({
        email: 'invalid-email',
        password: validPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid email format');
    });

    it('should reject weak password (400 Bad Request)', async () => {
      const request = createRequest({
        email: `test-${Date.now()}@example.com`,
        password: 'weak',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Password must be at least 8 characters');
    });

    it('should reject missing email field (400 Bad Request)', async () => {
      const request = createRequest({
        password: validPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Email is required');
    });

    it('should reject missing password field (400 Bad Request)', async () => {
      const request = createRequest({
        email: `test-${Date.now()}@example.com`,
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
        password: validPassword,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should reject empty password (400 Bad Request)', async () => {
      const request = createRequest({
        email: `test-${Date.now()}@example.com`,
        password: '',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });
});
