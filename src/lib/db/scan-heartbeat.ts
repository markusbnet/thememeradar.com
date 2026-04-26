/**
 * Scan heartbeat. Persists an authoritative record of every scan run so the
 * health endpoint can report pipeline liveness without inferring from
 * mention timestamps (which hide failures behind stale data from prior runs).
 *
 * Status model:
 *   running — started, not yet finished. If seen in health > lockTTL ago,
 *             treat as stuck/crashed.
 *   success — finished cleanly with summary.
 *   failed  — threw; errorMessage captured.
 *
 * One row per lockKey='heartbeat' — each run overwrites the previous entry.
 * Historical runs are not retained here (not the heartbeat's job — logs are).
 */

import { docClient, TABLES, PutCommand, GetCommand } from './client';

const HEARTBEAT_KEY = 'heartbeat';

export type ScanRunStatus = 'running' | 'success' | 'failed';

export interface ScanHeartbeat {
  lockKey: typeof HEARTBEAT_KEY;
  status: ScanRunStatus;
  startedAt: number;
  finishedAt: number | null;
  runDurationMs: number | null;
  runId: string;
  errorMessage: string | null;
  summary: {
    totalPosts: number;
    totalComments: number;
    totalMentions: number;
    totalUniqueTickers: number;
    subreddits: string[];
  } | null;
}

export async function recordScanStarted(params: {
  runId: string;
  now?: number;
}): Promise<void> {
  const now = params.now ?? Date.now();
  await docClient.send(
    new PutCommand({
      TableName: TABLES.SCAN_STATE,
      Item: {
        lockKey: HEARTBEAT_KEY,
        status: 'running' as ScanRunStatus,
        startedAt: now,
        finishedAt: null,
        runDurationMs: null,
        runId: params.runId,
        errorMessage: null,
        summary: null,
      },
    })
  );
}

export async function recordScanSuccess(params: {
  runId: string;
  startedAt: number;
  summary: NonNullable<ScanHeartbeat['summary']>;
  now?: number;
}): Promise<void> {
  const now = params.now ?? Date.now();
  await docClient.send(
    new PutCommand({
      TableName: TABLES.SCAN_STATE,
      Item: {
        lockKey: HEARTBEAT_KEY,
        status: 'success' as ScanRunStatus,
        startedAt: params.startedAt,
        finishedAt: now,
        runDurationMs: now - params.startedAt,
        runId: params.runId,
        errorMessage: null,
        summary: params.summary,
      },
    })
  );
}

export async function recordScanFailed(params: {
  runId: string;
  startedAt: number;
  errorMessage: string;
  now?: number;
}): Promise<void> {
  const now = params.now ?? Date.now();
  await docClient.send(
    new PutCommand({
      TableName: TABLES.SCAN_STATE,
      Item: {
        lockKey: HEARTBEAT_KEY,
        status: 'failed' as ScanRunStatus,
        startedAt: params.startedAt,
        finishedAt: now,
        runDurationMs: now - params.startedAt,
        runId: params.runId,
        errorMessage: params.errorMessage.slice(0, 1000),
        summary: null,
      },
    })
  );
}

export async function getScanHeartbeat(): Promise<ScanHeartbeat | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: TABLES.SCAN_STATE,
      Key: { lockKey: HEARTBEAT_KEY },
    })
  );
  return (res.Item as ScanHeartbeat | undefined) ?? null;
}
