/**
 * Boot smoke test. Run with: npm run test:smoke
 *
 * Checks — in order — that every integration point a fresh clone needs is
 * working. Each step prints its status and exits non-zero on first failure
 * so CI / the user gets a single clear error instead of a wall of output.
 *
 * Assumes DynamoDB Local is running. Starts its own server on an isolated
 * port so it never fights a developer-run `npm run dev`.
 *
 * In CI (process.env.CI=true) or when a .next build exists, uses
 * `next start` so the prebuilt artifact is validated and startup is fast.
 * Falls back to `next dev` for local runs without a build.
 */

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const SMOKE_PORT = 3007;
const BASE_URL = `http://localhost:${SMOKE_PORT}`;
const CRON_SECRET = process.env.CRON_SECRET || 'smoke-test-cron-secret';

type StepResult = { name: string; ok: boolean; detail?: string };
const steps: StepResult[] = [];

function record(name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`  ${icon} ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) throw new Error(`smoke step failed: ${name}${detail ? ' — ' + detail : ''}`);
}

async function checkEnv() {
  console.log('\n[1/6] env configuration');
  const required = [
    'DYNAMODB_ENDPOINT',
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ];
  for (const key of required) {
    record(`env.${key}`, !!process.env[key]);
  }
}

async function checkDb() {
  console.log('\n[2/6] database + tables');
  const { DynamoDBClient, ListTablesCommand } = await import(
    '@aws-sdk/client-dynamodb'
  );
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION!,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const res = await client.send(new ListTablesCommand({}));
  const tables = new Set(res.TableNames ?? []);
  record('dynamodb reachable', true, `${tables.size} tables`);
  for (const t of ['users', 'stock_mentions', 'stock_evidence']) {
    record(`table ${t} exists`, tables.has(t));
  }
}

async function seed() {
  console.log('\n[3/6] seeding fixture');
  await runCommand('tsx', ['--env-file=.env.local', 'scripts/seed-db.ts']);
  record('db:seed', true);
}

function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });
}

function killServer(srv: ReturnType<typeof spawn>) {
  try {
    srv.kill('SIGTERM');
  } catch {}
  // Escalate to SIGKILL after 3s so lingering Next.js workers don't block exit.
  setTimeout(() => {
    try { srv.kill('SIGKILL'); } catch {}
  }, 3000).unref();
}

async function startServer(): Promise<() => void> {
  // Use `next start` (prebuilt) when a build exists or when running in CI —
  // it starts in ~1s vs 30-60s for `next dev` on a cold compile.
  const hasBuild = existsSync('.next/BUILD_ID');
  const useStart = hasBuild || process.env.CI === 'true';
  const nextArgs = useStart
    ? ['next', 'start', '-p', String(SMOKE_PORT)]
    : ['next', 'dev', '-p', String(SMOKE_PORT)];
  console.log(`\n[4/6] server on :${SMOKE_PORT} (${useStart ? 'next start' : 'next dev'})`);

  const srv = spawn('npx', nextArgs, {
    env: {
      ...process.env,
      CRON_SECRET,
      JWT_SECRET: process.env.JWT_SECRET || 'smoke-jwt',
      REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID || 'smoke-client',
      REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET || 'smoke-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stdout?.on('data', () => {});
  srv.stderr?.on('data', (d) => process.stderr.write(d));

  // Poll /api/health — more reliable than parsing Next.js "Ready" log lines.
  const readyTimeout = useStart ? 30_000 : 90_000;
  const deadline = Date.now() + readyTimeout;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (r.status === 200 || r.status === 503) {
        record('server responds', true);
        break;
      }
    } catch {
      // ignore until timeout
    }
    await delay(500);
  }
  if (Date.now() >= deadline) {
    killServer(srv);
    record('server responds', false, 'timeout');
  }

  return () => killServer(srv);
}

async function checkApis() {
  console.log('\n[5/6] API endpoints');

  const health = await fetch(`${BASE_URL}/api/health`).then((r) => r.json());
  record(
    'GET /api/health ok',
    ['ok', 'degraded'].includes(health.data.status),
    `status=${health.data.status}`
  );

  const trending = await fetch(`${BASE_URL}/api/stocks/trending`).then((r) =>
    r.json()
  );
  record(
    'GET /api/stocks/trending returns data',
    trending.success === true && Array.isArray(trending.data?.trending),
    `${trending.data?.trending?.length ?? 0} tickers`
  );
  record(
    'trending has >=1 row after seed',
    (trending.data?.trending?.length ?? 0) > 0
  );
}

async function checkAuthedUi() {
  console.log('\n[6/6] auth + UI');
  const email = `smoke-${Date.now()}@thememeradar.test`;
  const signup = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SmokePass123!' }),
  });
  record('POST /api/auth/signup', signup.status === 200 || signup.status === 201);

  const cookie = signup.headers.get('set-cookie') || '';
  const me = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  record('GET /api/auth/me authed', me.status === 200);

  // Cleanup — avoid leaving smoke users in the DB between runs.
  await fetch(`${BASE_URL}/api/test/delete-user`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

async function main() {
  console.log('=== meme radar smoke test ===');
  let stopServer: (() => void) | null = null;
  try {
    await checkEnv();
    await checkDb();
    await seed();
    stopServer = await startServer();
    await checkApis();
    await checkAuthedUi();
    console.log('\n✓ all smoke checks passed');
  } catch (err: any) {
    console.error(`\n✗ smoke failed: ${err?.message || err}`);
    process.exitCode = 1;
  } finally {
    if (stopServer) stopServer();
    // Force exit — fetch keep-alive connections and child process streams can
    // otherwise hold the event loop open indefinitely.
    setTimeout(() => process.exit(process.exitCode ?? 0), 4000).unref();
    process.exit(process.exitCode ?? 0);
  }
}

main();
