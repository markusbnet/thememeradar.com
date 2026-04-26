/**
 * System health endpoint. Returns a structured view of every subsystem the
 * dashboard depends on so humans and CI can diagnose "why is the app not
 * working" without reading logs.
 *
 * Status model:
 *   ok       → DB reachable, all required tables present, env complete,
 *              recent scan data exists.
 *   degraded → everything connects but some soft signal is off (no recent
 *              scans yet, or an optional env var is missing).
 *   down     → DB unreachable OR a required table is missing. Returns 503
 *              so uptime checks and `curl -f` can detect it.
 */

import { NextResponse } from 'next/server';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { docClient, TABLES } from '@/lib/db/client';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getScanHeartbeat, type ScanRunStatus } from '@/lib/db/scan-heartbeat';

const REQUIRED_ENV_VARS = [
  'CRON_SECRET',
  'JWT_SECRET',
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET',
  'AWS_REGION',
] as const;

// Tables the runtime needs. Intentionally narrower than init-db's full list —
// only the ones whose absence breaks user-visible features today. Add entries
// here as features go live so health fails fast when a migration is missed.
const REQUIRED_TABLES = [
  TABLES.STOCK_MENTIONS,
  TABLES.STOCK_EVIDENCE,
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function buildControlClient() {
  return new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

async function checkDbAndTables() {
  try {
    const client = buildControlClient();
    const result = await client.send(new ListTablesCommand({}));
    const present = new Set(result.TableNames ?? []);
    const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
    return {
      db: { ok: true as const, endpoint: process.env.DYNAMODB_ENDPOINT || 'aws' },
      tables: { ok: missing.length === 0, missing, present: [...present] },
    };
  } catch (error: any) {
    return {
      db: { ok: false as const, error: error?.message || String(error) },
      tables: { ok: false, missing: REQUIRED_TABLES, present: [] },
    };
  }
}

async function checkScanFreshness() {
  // Counts mentions recorded in the last 24h and finds the latest timestamp.
  // Scan is fine here: stock_mentions stays small under TTL, and this runs
  // once per health check rather than per user request.
  try {
    const since = Date.now() - ONE_DAY_MS;
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLES.STOCK_MENTIONS,
        FilterExpression: '#ts >= :since',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: { ':since': since },
        ProjectionExpression: '#ts',
      })
    );
    const items = res.Items ?? [];
    const lastScanAt = items.length
      ? Math.max(...items.map((i: any) => Number(i.timestamp) || 0))
      : null;
    return {
      ok: items.length > 0,
      lastScanAt,
      recentMentions: items.length,
    };
  } catch (error: any) {
    return {
      ok: false,
      lastScanAt: null,
      recentMentions: 0,
      error: error?.message || String(error),
    };
  }
}

// Heartbeat is the authoritative "did the last scan succeed" signal. The
// older scan-freshness check above just looks at mention timestamps, which
// can lag for benign reasons (no tickers matched the last run). Heartbeat
// gives us a reliable failure detector within one cron cycle.
const STUCK_RUNNING_THRESHOLD_MS = 15 * 60 * 1000;

async function checkScanRun(): Promise<{
  ok: boolean;
  status: ScanRunStatus | 'unknown';
  lastRunStartedAt: number | null;
  lastRunFinishedAt: number | null;
  runDurationMs: number | null;
  errorMessage: string | null;
  runId: string | null;
}> {
  try {
    const hb = await getScanHeartbeat();
    if (!hb) {
      // No heartbeat row yet — fresh deployment or pre-migration DB. Don't
      // mark the system as degraded on absence alone; the scan-freshness
      // check already handles "no data yet" via status=degraded at the
      // higher level. ok=true here prevents false alarms on cold-start.
      return {
        ok: true,
        status: 'unknown',
        lastRunStartedAt: null,
        lastRunFinishedAt: null,
        runDurationMs: null,
        errorMessage: null,
        runId: null,
      };
    }

    // A 'running' status older than the stuck threshold almost always means
    // the function was killed mid-scan. Degrade on that even though the
    // heartbeat row itself reports no failure. An actively-running scan
    // (started recently) is fine — don't degrade on it.
    const stuck =
      hb.status === 'running' &&
      Date.now() - hb.startedAt > STUCK_RUNNING_THRESHOLD_MS;
    const ok = (hb.status === 'success' || hb.status === 'running') && !stuck;

    return {
      ok,
      status: stuck ? 'failed' : hb.status,
      lastRunStartedAt: hb.startedAt,
      lastRunFinishedAt: hb.finishedAt,
      runDurationMs: hb.runDurationMs,
      errorMessage: stuck
        ? `Scan stuck in running state since ${new Date(hb.startedAt).toISOString()}`
        : hb.errorMessage,
      runId: hb.runId,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 'unknown',
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      runDurationMs: null,
      errorMessage: error?.message || String(error),
      runId: null,
    };
  }
}

function checkEnv() {
  const required: Record<string, boolean> = {};
  const missing: string[] = [];
  for (const key of REQUIRED_ENV_VARS) {
    const present = !!process.env[key];
    required[key] = present;
    if (!present) missing.push(key);
  }
  return { ok: missing.length === 0, required, missing };
}

export async function GET() {
  const [dbTables, scan, scanRun] = await Promise.all([
    checkDbAndTables(),
    checkScanFreshness(),
    checkScanRun(),
  ]);
  const env = checkEnv();

  const down = !dbTables.db.ok || !dbTables.tables.ok;
  const degraded = !down && (!env.ok || !scan.ok || !scanRun.ok);
  const status = down ? 'down' : degraded ? 'degraded' : 'ok';

  const body = {
    success: !down,
    data: {
      status,
      timestamp: Date.now(),
      subsystems: {
        db: dbTables.db,
        tables: dbTables.tables,
        env,
        scan,
        scanRun,
      },
    },
  };

  return NextResponse.json(body, { status: down ? 503 : 200 });
}
