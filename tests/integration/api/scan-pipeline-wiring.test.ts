/**
 * Route-level integration test for GET /api/scan. Verifies the lock,
 * heartbeat, and failure-alert modules are composed correctly inside the
 * route — not just that each works in isolation.
 *
 * What's mocked: scanner (Reddit), saveScanResults, alert-pipeline, and the
 * fire-and-forget enrichers. What's real: scan_state (lock + heartbeat) and
 * email_alerts (failure alerts) against DynamoDB Local. Mocking the DB writes
 * here would defeat the point — the wiring is the thing under test.
 */

jest.mock('@/lib/scanner/scanner', () => ({
  createScanner: jest.fn(),
}));

jest.mock('@/lib/db/storage', () => ({
  saveScanResults: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/alert-pipeline', () => ({
  checkAndCreateAlerts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/lunarcrush', () => ({
  enrichWithLunarCrush: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/market/finnhub', () => ({
  enrichWithPrices: jest.fn().mockResolvedValue(undefined),
}));

import { createScanner } from '@/lib/scanner/scanner';
import {
  docClient,
  TABLES,
  GetCommand,
  DeleteCommand,
  PutCommand,
  ScanCommand,
} from '@/lib/db/client';
import {
  acquireScanLock,
  releaseScanLock,
  DEFAULT_LOCK_KEY,
} from '@/lib/db/scan-lock';
import { __test as failureAlertTest } from '@/lib/scan-failure-alert';

const TEST_CRON_SECRET = 'wiring-cron-secret';
const HEARTBEAT_KEY = 'heartbeat';
const mockedCreateScanner = createScanner as jest.MockedFunction<typeof createScanner>;

function buildScanner(overrides?: {
  scanMultipleSubreddits?: jest.Mock;
}) {
  return {
    scanMultipleSubreddits:
      overrides?.scanMultipleSubreddits ??
      jest.fn().mockResolvedValue([
        {
          subreddit: 'wallstreetbets',
          tickers: new Map([['GME', { mentions: 3 }]]),
          stats: { totalPosts: 5, totalComments: 10, totalMentions: 3 },
        },
      ]),
    scanSubreddit: jest.fn(),
  };
}

async function clearScanState(): Promise<void> {
  await Promise.all([
    docClient.send(
      new DeleteCommand({
        TableName: TABLES.SCAN_STATE,
        Key: { lockKey: DEFAULT_LOCK_KEY },
      })
    ),
    docClient.send(
      new DeleteCommand({
        TableName: TABLES.SCAN_STATE,
        Key: { lockKey: HEARTBEAT_KEY },
      })
    ),
  ]);
}

async function clearScanFailureAlerts(): Promise<void> {
  const res = await docClient.send(
    new ScanCommand({
      TableName: TABLES.EMAIL_ALERTS,
      FilterExpression: 'ticker = :t',
      ExpressionAttributeValues: { ':t': failureAlertTest.SENTINEL_TICKER },
    })
  );
  for (const item of res.Items ?? []) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.EMAIL_ALERTS,
        Key: { ticker: item.ticker, createdAt: item.createdAt },
      })
    );
  }
}

async function getHeartbeat() {
  const res = await docClient.send(
    new GetCommand({
      TableName: TABLES.SCAN_STATE,
      Key: { lockKey: HEARTBEAT_KEY },
    })
  );
  return res.Item ?? null;
}

async function getLockRow() {
  const res = await docClient.send(
    new GetCommand({
      TableName: TABLES.SCAN_STATE,
      Key: { lockKey: DEFAULT_LOCK_KEY },
    })
  );
  return res.Item ?? null;
}

function createRequest() {
  return new Request('http://localhost:3000/api/scan', {
    method: 'GET',
    headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
  });
}

describe('GET /api/scan — pipeline wiring (lock + heartbeat + alert)', () => {
  beforeAll(() => {
    process.env.REDDIT_CLIENT_ID = 'test-client-id';
    process.env.REDDIT_CLIENT_SECRET = 'test-client-secret';
    process.env.CRON_SECRET = TEST_CRON_SECRET;
  });

  beforeEach(async () => {
    mockedCreateScanner.mockReset();
    await clearScanState();
    await clearScanFailureAlerts();
  });

  afterAll(async () => {
    await clearScanState();
    await clearScanFailureAlerts();
  });

  it('success path: writes success heartbeat and releases the lock', async () => {
    mockedCreateScanner.mockReturnValue(buildScanner() as any);

    const { GET } = await import('@/app/api/scan/route');
    const response = await GET(createRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalMentions).toBe(3);

    const heartbeat = await getHeartbeat();
    expect(heartbeat).not.toBeNull();
    expect(heartbeat!.status).toBe('success');
    expect(heartbeat!.runId).toEqual(expect.any(String));
    expect(heartbeat!.summary).toMatchObject({
      totalPosts: 5,
      totalComments: 10,
      totalMentions: 3,
      totalUniqueTickers: 1,
    });
    expect(typeof heartbeat!.runDurationMs).toBe('number');

    // Lock released: a fresh acquire must succeed without forcing a TTL steal.
    const lockRow = await getLockRow();
    expect(lockRow).toBeNull();

    const followup = await acquireScanLock({ holder: 'follow-up-check' });
    expect(followup.acquired).toBe(true);
    await releaseScanLock({ holder: 'follow-up-check' });
  });

  it('failure path: writes failed heartbeat, alert row, and releases the lock', async () => {
    const scannerError = new Error('Reddit API exploded');
    mockedCreateScanner.mockReturnValue(
      buildScanner({
        scanMultipleSubreddits: jest.fn().mockRejectedValue(scannerError),
      }) as any
    );

    const { GET } = await import('@/app/api/scan/route');
    const response = await GET(createRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Reddit API exploded');

    const heartbeat = await getHeartbeat();
    expect(heartbeat).not.toBeNull();
    expect(heartbeat!.status).toBe('failed');
    expect(heartbeat!.errorMessage).toBe('Reddit API exploded');
    expect(heartbeat!.summary).toBeNull();

    // Failure alert row landed in email_alerts under the sentinel ticker.
    const alerts = await docClient.send(
      new ScanCommand({
        TableName: TABLES.EMAIL_ALERTS,
        FilterExpression: 'ticker = :t',
        ExpressionAttributeValues: {
          ':t': failureAlertTest.SENTINEL_TICKER,
        },
      })
    );
    expect(alerts.Items?.length).toBe(1);
    expect(alerts.Items![0].emailBody).toContain('Reddit API exploded');

    // Lock released even when the scan threw.
    expect(await getLockRow()).toBeNull();
    const followup = await acquireScanLock({ holder: 'follow-up-check' });
    expect(followup.acquired).toBe(true);
    await releaseScanLock({ holder: 'follow-up-check' });
  });

  it('skip path: when the lock is held, returns skipped without touching heartbeat', async () => {
    // Pre-acquire the lock as a different holder — simulates an in-flight
    // cron tick. The route must back off, not steal it.
    const otherHolder = await acquireScanLock({ holder: 'other-cron-tick' });
    expect(otherHolder.acquired).toBe(true);

    // Pre-existing heartbeat from a prior run — must not be overwritten.
    const priorHeartbeat = {
      lockKey: HEARTBEAT_KEY,
      status: 'success' as const,
      startedAt: Date.now() - 60_000,
      finishedAt: Date.now() - 30_000,
      runDurationMs: 30_000,
      runId: 'prior-run-id',
      errorMessage: null,
      summary: {
        totalPosts: 99,
        totalComments: 99,
        totalMentions: 99,
        totalUniqueTickers: 99,
        subreddits: ['wallstreetbets'],
      },
    };
    await docClient.send(
      new PutCommand({
        TableName: TABLES.SCAN_STATE,
        Item: priorHeartbeat,
      })
    );

    mockedCreateScanner.mockReturnValue(buildScanner() as any);

    const { GET } = await import('@/app/api/scan/route');
    const response = await GET(createRequest() as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.skipped).toBe(true);
    expect(data.reason).toMatch(/another scan is in progress/i);

    // Scanner must never have been called — the route returned before
    // touching any work.
    expect(mockedCreateScanner).not.toHaveBeenCalled();

    // Heartbeat unchanged — the prior-run row is intact.
    const heartbeat = await getHeartbeat();
    expect(heartbeat).toMatchObject({
      runId: 'prior-run-id',
      status: 'success',
    });

    // No failure alert was emitted.
    const alerts = await docClient.send(
      new ScanCommand({
        TableName: TABLES.EMAIL_ALERTS,
        FilterExpression: 'ticker = :t',
        ExpressionAttributeValues: {
          ':t': failureAlertTest.SENTINEL_TICKER,
        },
        Select: 'COUNT',
      })
    );
    expect(alerts.Count).toBe(0);

    // Original holder still owns the lock.
    const lockRow = await getLockRow();
    expect(lockRow?.heldBy).toBe('other-cron-tick');

    await releaseScanLock({ holder: 'other-cron-tick' });
  });
});
