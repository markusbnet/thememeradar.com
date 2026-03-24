import { createUser, getUserByEmail, getUserById, updateLastLogin, deleteUserByEmail } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth/password';

describe('User DB Operations', () => {
  const testEmail = `users-unit-${Date.now()}@example.com`;
  let userId: string;

  afterAll(async () => {
    await deleteUserByEmail(testEmail);
  });

  describe('createUser', () => {
    it('should create a user and return user object', async () => {
      const passwordHash = await hashPassword('TestPass123!');
      const user = await createUser({ email: testEmail, passwordHash });

      userId = user.userId;
      expect(user.userId).toBeDefined();
      expect(user.email).toBe(testEmail.toLowerCase());
      expect(user.passwordHash).toBe(passwordHash);
      expect(user.createdAt).toBeDefined();
      expect(user.lastLoginAt).toBeDefined();
    });

    it('should throw if email already exists', async () => {
      const passwordHash = await hashPassword('TestPass123!');
      await expect(
        createUser({ email: testEmail, passwordHash })
      ).rejects.toThrow('Email already registered');
    });

    it('should normalize email to lowercase', async () => {
      const upperEmail = `UPPER-${Date.now()}@EXAMPLE.COM`;
      const passwordHash = await hashPassword('TestPass123!');
      const user = await createUser({ email: upperEmail, passwordHash });

      expect(user.email).toBe(upperEmail.toLowerCase());
      await deleteUserByEmail(upperEmail);
    });
  });

  describe('getUserByEmail', () => {
    it('should find existing user by email', async () => {
      const user = await getUserByEmail(testEmail);
      expect(user).not.toBeNull();
      expect(user!.userId).toBe(userId);
    });

    it('should return null for non-existent email', async () => {
      const user = await getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const user = await getUserByEmail(testEmail.toUpperCase());
      expect(user).not.toBeNull();
      expect(user!.userId).toBe(userId);
    });
  });

  describe('getUserById', () => {
    it('should find existing user by ID', async () => {
      const user = await getUserById(userId);
      expect(user).not.toBeNull();
      expect(user!.email).toBe(testEmail.toLowerCase());
    });

    it('should return null for non-existent ID', async () => {
      const user = await getUserById('nonexistent-id');
      expect(user).toBeNull();
    });
  });

  describe('updateLastLogin', () => {
    it('should update lastLoginAt without affecting other fields', async () => {
      const before = await getUserById(userId);
      await updateLastLogin(userId);
      const after = await getUserById(userId);

      expect(after!.lastLoginAt).toBeGreaterThanOrEqual(before!.lastLoginAt);
      expect(after!.email).toBe(before!.email);
      expect(after!.passwordHash).toBe(before!.passwordHash);
      expect(after!.createdAt).toBe(before!.createdAt);
    });
  });

  describe('deleteUserByEmail', () => {
    it('should delete an existing user', async () => {
      const tempEmail = `temp-del-${Date.now()}@example.com`;
      const passwordHash = await hashPassword('TestPass123!');
      await createUser({ email: tempEmail, passwordHash });

      await deleteUserByEmail(tempEmail);
      const user = await getUserByEmail(tempEmail);
      expect(user).toBeNull();
    });

    it('should not throw when deleting non-existent user', async () => {
      await expect(
        deleteUserByEmail('no-such-user@example.com')
      ).resolves.not.toThrow();
    });
  });
});
