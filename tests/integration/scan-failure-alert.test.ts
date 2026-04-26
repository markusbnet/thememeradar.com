/**
 * Integration tests for scan failure alerting. Verifies:
 *   - An alert row is written when a scan fails.
 *   - Repeated failures inside the cooldown window do NOT write duplicates
 *     (the storm-control contract — critical for avoiding 288 alerts/day).
 *   - Once the cooldown elapses, a new alert is written.
 */

import {
  recordScanFailureAlert,
  __test,
} from '@/lib/scan-failure-alert';
import { docClient, TABLES, ScanCommand, DeleteCommand } from '@/lib/db/client';

async function clearScanFailureAlerts(): Promise<void> {
  const res = await docClient.send(
    new ScanCommand({
      TableName: TABLES.EMAIL_ALERTS,
      FilterExpression: 'ticker = :t',
      ExpressionAttributeValues: { ':t': __test.SENTINEL_TICKER },
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

async function countScanFailureAlerts(): Promise<number> {
  const res = await docClient.send(
    new ScanCommand({
      TableName: TABLES.EMAIL_ALERTS,
      FilterExpression: 'ticker = :t',
      ExpressionAttributeValues: { ':t': __test.SENTINEL_TICKER },
      Select: 'COUNT',
    })
  );
  return res.Count ?? 0;
}

describe('recordScanFailureAlert (DynamoDB Local)', () => {
  beforeEach(async () => {
    await clearScanFailureAlerts();
  });

  afterAll(async () => {
    await clearScanFailureAlerts();
  });

  it('writes an alert row on first failure', async () => {
    const result = await recordScanFailureAlert({
      errorMessage: 'Reddit API rate-limited',
      runId: 'run-a',
    });
    expect(result.written).toBe(true);
    expect(await countScanFailureAlerts()).toBe(1);
  });

  it('suppresses duplicate alerts within the cooldown window', async () => {
    await recordScanFailureAlert({
      errorMessage: 'first failure',
      runId: 'run-1',
      now: 10_000_000,
    });
    // Second failure 5 min later — well within default 30 min cooldown.
    const second = await recordScanFailureAlert({
      errorMessage: 'second failure',
      runId: 'run-2',
      now: 10_000_000 + 5 * 60 * 1000,
    });
    expect(second.written).toBe(false);
    expect(second.reason).toBe('cooldown-active');
    expect(await countScanFailureAlerts()).toBe(1);
  });

  it('writes a new alert once the cooldown has elapsed', async () => {
    await recordScanFailureAlert({
      errorMessage: 'old failure',
      runId: 'run-1',
      now: 10_000_000,
    });
    const second = await recordScanFailureAlert({
      errorMessage: 'new failure',
      runId: 'run-2',
      now: 10_000_000 + 31 * 60 * 1000, // 31 min > 30 min cooldown
    });
    expect(second.written).toBe(true);
    expect(await countScanFailureAlerts()).toBe(2);
  });

  it('truncates very long error messages in the body', async () => {
    const huge = 'z'.repeat(5000);
    await recordScanFailureAlert({ errorMessage: huge, runId: 'run-3' });

    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLES.EMAIL_ALERTS,
        FilterExpression: 'ticker = :t',
        ExpressionAttributeValues: { ':t': __test.SENTINEL_TICKER },
      })
    );
    const body = (res.Items?.[0]?.emailBody as string) ?? '';
    // Body contains headers + error + footers. Error block is truncated at
    // 1000 chars, so total body stays well under 10000.
    expect(body.length).toBeLessThan(2000);
  });
});
