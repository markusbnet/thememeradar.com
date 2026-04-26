/**
 * Scan mutex. Prevents two Vercel Cron invocations of /api/scan from
 * overlapping and double-writing the same 15-minute bucket.
 *
 * Design:
 *   - Single-row lock in scan_state table (lockKey='lock').
 *   - Conditional Put on acquire: row must not exist, OR its expiresAt must
 *     be in the past. That second clause makes the lock self-healing —
 *     if a scan function was killed mid-run, the next cron naturally takes
 *     over once expiresAt passes, without any manual cleanup.
 *   - Conditional Delete on release: we only release if we still hold the
 *     lock. Prevents releasing someone else's newer lock if our function
 *     was slow and the TTL already elapsed.
 *
 * TTL attribute is a failsafe: DynamoDB auto-deletes the row ~48h after
 * expiresAt even if the lock is never released, so the table stays tiny.
 */

import { docClient, TABLES, PutCommand, DeleteCommand } from './client';

// Production uses a single lock row ('lock'). Tests pass a unique key per
// test file to avoid parallel-execution collisions in DynamoDB Local.
export const DEFAULT_LOCK_KEY = 'lock';
// Rounded up from the worst-case observed scan duration (~60s for 7 subs).
// Short enough that a dead-scan cron overlap resolves within 2 cycles.
const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000;

export interface AcquireResult {
  acquired: boolean;
  heldBy?: string;
  expiresAt?: number;
}

export async function acquireScanLock(options: {
  holder: string;
  ttlMs?: number;
  now?: number;
  lockKey?: string;
}): Promise<AcquireResult> {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  const expiresAt = now + ttlMs;
  const lockKey = options.lockKey ?? DEFAULT_LOCK_KEY;

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.SCAN_STATE,
        Item: {
          lockKey,
          heldBy: options.holder,
          acquiredAt: now,
          expiresAt,
          // DynamoDB TTL is seconds-since-epoch. Keep the lock row around for
          // 2 days past expiry so operators can inspect the last holder.
          ttl: Math.floor(expiresAt / 1000) + 2 * 24 * 60 * 60,
        },
        ConditionExpression:
          'attribute_not_exists(lockKey) OR expiresAt < :now',
        ExpressionAttributeValues: {
          ':now': now,
        },
      })
    );
    return { acquired: true, heldBy: options.holder, expiresAt };
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === 'ConditionalCheckFailedException') {
      return { acquired: false };
    }
    throw err;
  }
}

export async function releaseScanLock(options: {
  holder: string;
  lockKey?: string;
}): Promise<{ released: boolean }> {
  const lockKey = options.lockKey ?? DEFAULT_LOCK_KEY;
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.SCAN_STATE,
        Key: { lockKey },
        ConditionExpression: 'heldBy = :holder',
        ExpressionAttributeValues: {
          ':holder': options.holder,
        },
      })
    );
    return { released: true };
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === 'ConditionalCheckFailedException') {
      // Someone else already holds the lock (ours expired and was stolen).
      // Safe to swallow — there's nothing to release.
      return { released: false };
    }
    throw err;
  }
}
