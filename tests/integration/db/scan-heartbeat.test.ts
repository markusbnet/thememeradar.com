/**
 * Integration tests for scan heartbeat. Uses DynamoDB Local so status
 * transitions (running → success, running → failed) are exercised end-to-end.
 */

import {
  recordScanStarted,
  recordScanSuccess,
  recordScanFailed,
  getScanHeartbeat,
} from '@/lib/db/scan-heartbeat';
import { docClient, TABLES, DeleteCommand } from '@/lib/db/client';

async function clearHeartbeat(): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.SCAN_STATE,
      Key: { lockKey: 'heartbeat' },
    })
  );
}

describe('scan-heartbeat (DynamoDB Local)', () => {
  beforeEach(async () => {
    await clearHeartbeat();
  });

  afterAll(async () => {
    await clearHeartbeat();
  });

  it('returns null before any scan has run', async () => {
    expect(await getScanHeartbeat()).toBeNull();
  });

  it('records a running status when scan starts', async () => {
    await recordScanStarted({ runId: 'run-1', now: 1_000_000 });

    const hb = await getScanHeartbeat();
    expect(hb).not.toBeNull();
    expect(hb!.status).toBe('running');
    expect(hb!.startedAt).toBe(1_000_000);
    expect(hb!.finishedAt).toBeNull();
    expect(hb!.runId).toBe('run-1');
    expect(hb!.summary).toBeNull();
    expect(hb!.errorMessage).toBeNull();
  });

  it('transitions running → success with duration and summary', async () => {
    await recordScanStarted({ runId: 'run-2', now: 1_000_000 });
    await recordScanSuccess({
      runId: 'run-2',
      startedAt: 1_000_000,
      now: 1_060_000,
      summary: {
        totalPosts: 100,
        totalComments: 500,
        totalMentions: 200,
        totalUniqueTickers: 50,
        subreddits: ['wallstreetbets', 'stocks'],
      },
    });

    const hb = await getScanHeartbeat();
    expect(hb!.status).toBe('success');
    expect(hb!.runDurationMs).toBe(60_000);
    expect(hb!.finishedAt).toBe(1_060_000);
    expect(hb!.summary?.totalMentions).toBe(200);
    expect(hb!.errorMessage).toBeNull();
  });

  it('transitions running → failed with error message', async () => {
    await recordScanStarted({ runId: 'run-3', now: 1_000_000 });
    await recordScanFailed({
      runId: 'run-3',
      startedAt: 1_000_000,
      now: 1_005_000,
      errorMessage: 'Reddit API 503',
    });

    const hb = await getScanHeartbeat();
    expect(hb!.status).toBe('failed');
    expect(hb!.errorMessage).toBe('Reddit API 503');
    expect(hb!.runDurationMs).toBe(5_000);
    expect(hb!.summary).toBeNull();
  });

  it('truncates absurdly long error messages to protect the row size', async () => {
    const huge = 'x'.repeat(10_000);
    await recordScanStarted({ runId: 'run-4', now: 1_000_000 });
    await recordScanFailed({
      runId: 'run-4',
      startedAt: 1_000_000,
      now: 1_001_000,
      errorMessage: huge,
    });

    const hb = await getScanHeartbeat();
    expect(hb!.errorMessage!.length).toBe(1000);
  });

  it('overwrites the previous heartbeat row on each run', async () => {
    await recordScanStarted({ runId: 'old-run', now: 1_000_000 });
    await recordScanSuccess({
      runId: 'old-run',
      startedAt: 1_000_000,
      now: 1_050_000,
      summary: {
        totalPosts: 10,
        totalComments: 20,
        totalMentions: 30,
        totalUniqueTickers: 5,
        subreddits: ['stocks'],
      },
    });

    await recordScanStarted({ runId: 'new-run', now: 2_000_000 });

    const hb = await getScanHeartbeat();
    expect(hb!.runId).toBe('new-run');
    expect(hb!.status).toBe('running');
    expect(hb!.finishedAt).toBeNull();
    expect(hb!.summary).toBeNull();
  });
});
