/**
 * Integration tests for the scan mutex. Runs against DynamoDB Local — mocking
 * defeats the point since the lock's correctness comes entirely from DynamoDB's
 * conditional-write guarantees.
 *
 * Each test cleans up the single lock row explicitly; tests run serially within
 * a file so there is no cross-test contention.
 */

import { acquireScanLock, releaseScanLock } from '@/lib/db/scan-lock';
import { docClient, TABLES, DeleteCommand } from '@/lib/db/client';

// Use a test-scoped lock key so parallel jest workers touching the same
// DynamoDB Local don't race on the production 'lock' row.
const LOCK_KEY = 'test-scan-lock-suite';

async function clearLock(): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.SCAN_STATE,
      Key: { lockKey: LOCK_KEY },
    })
  );
}

describe('scan-lock (DynamoDB Local)', () => {
  beforeEach(async () => {
    await clearLock();
  });

  afterAll(async () => {
    await clearLock();
  });

  it('acquires the lock when no holder exists', async () => {
    const result = await acquireScanLock({ holder: 'worker-1', lockKey: LOCK_KEY });
    expect(result.acquired).toBe(true);
    expect(result.heldBy).toBe('worker-1');
  });

  it('rejects a second concurrent acquire while the lock is held', async () => {
    const first = await acquireScanLock({ holder: 'worker-1', lockKey: LOCK_KEY });
    expect(first.acquired).toBe(true);

    const second = await acquireScanLock({ holder: 'worker-2', lockKey: LOCK_KEY });
    expect(second.acquired).toBe(false);
    expect(second.heldBy).toBeUndefined();
  });

  it('allows a new holder to steal the lock after expiresAt passes', async () => {
    // Acquire with an already-expired timestamp — simulates a dead prior
    // worker whose function was killed before release.
    const now = Date.now();
    await acquireScanLock({
      holder: 'dead-worker',
      ttlMs: 1,
      now: now - 60_000,
      lockKey: LOCK_KEY,
    });

    const fresh = await acquireScanLock({ holder: 'live-worker', now, lockKey: LOCK_KEY });
    expect(fresh.acquired).toBe(true);
    expect(fresh.heldBy).toBe('live-worker');
  });

  it('releases the lock when called by the original holder', async () => {
    await acquireScanLock({ holder: 'worker-1', lockKey: LOCK_KEY });
    const release = await releaseScanLock({ holder: 'worker-1', lockKey: LOCK_KEY });
    expect(release.released).toBe(true);

    // Lock is now free — a new holder can acquire.
    const next = await acquireScanLock({ holder: 'worker-2', lockKey: LOCK_KEY });
    expect(next.acquired).toBe(true);
  });

  it('refuses to release when caller is not the current holder', async () => {
    await acquireScanLock({ holder: 'worker-1', lockKey: LOCK_KEY });
    const release = await releaseScanLock({ holder: 'impostor', lockKey: LOCK_KEY });
    expect(release.released).toBe(false);

    // Original holder still holds it — another acquire must still fail.
    const blocked = await acquireScanLock({ holder: 'worker-3', lockKey: LOCK_KEY });
    expect(blocked.acquired).toBe(false);
  });

  it('after stolen-via-TTL, original holder release is a no-op', async () => {
    // worker-1 takes out an expired lock (still inside the row).
    await acquireScanLock({
      holder: 'worker-1',
      ttlMs: 1,
      now: Date.now() - 60_000,
      lockKey: LOCK_KEY,
    });

    // worker-2 steals it.
    const stolen = await acquireScanLock({ holder: 'worker-2', lockKey: LOCK_KEY });
    expect(stolen.acquired).toBe(true);

    // worker-1 tries to release — must not delete worker-2's lock.
    const release = await releaseScanLock({ holder: 'worker-1', lockKey: LOCK_KEY });
    expect(release.released).toBe(false);

    // worker-2 still holds it.
    const blocked = await acquireScanLock({ holder: 'worker-3', lockKey: LOCK_KEY });
    expect(blocked.acquired).toBe(false);
  });
});
