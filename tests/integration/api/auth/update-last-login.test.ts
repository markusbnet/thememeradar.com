import { createUser, getUserById, updateLastLogin, deleteUserByEmail } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth/password';

describe('updateLastLogin', () => {
  const testEmail = `lastlogin-test-${Date.now()}@example.com`;
  let userId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('TestPass123!');
    const user = await createUser({ email: testEmail, passwordHash });
    userId = user.userId;
  });

  afterAll(async () => {
    await deleteUserByEmail(testEmail);
  });

  it('should update lastLoginAt timestamp', async () => {
    const before = Date.now();
    await updateLastLogin(userId);
    const after = Date.now();

    const user = await getUserById(userId);
    expect(user).not.toBeNull();
    expect(user!.lastLoginAt).toBeGreaterThanOrEqual(before);
    expect(user!.lastLoginAt).toBeLessThanOrEqual(after);
  });

  it('should preserve email after updateLastLogin', async () => {
    await updateLastLogin(userId);

    const user = await getUserById(userId);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(testEmail.toLowerCase());
  });

  it('should preserve passwordHash after updateLastLogin', async () => {
    const userBefore = await getUserById(userId);
    await updateLastLogin(userId);
    const userAfter = await getUserById(userId);

    expect(userAfter).not.toBeNull();
    expect(userAfter!.passwordHash).toBe(userBefore!.passwordHash);
  });

  it('should preserve createdAt after updateLastLogin', async () => {
    const userBefore = await getUserById(userId);
    await updateLastLogin(userId);
    const userAfter = await getUserById(userId);

    expect(userAfter).not.toBeNull();
    expect(userAfter!.createdAt).toBe(userBefore!.createdAt);
  });

  it('should allow re-login after updateLastLogin (fields intact)', async () => {
    await updateLastLogin(userId);

    // User should still be retrievable by email (email not wiped)
    const { getUserByEmail } = await import('@/lib/db/users');
    const user = await getUserByEmail(testEmail);
    expect(user).not.toBeNull();
    expect(user!.userId).toBe(userId);
    expect(user!.passwordHash).toBeDefined();
    expect(user!.passwordHash.length).toBeGreaterThan(0);
  });
});
