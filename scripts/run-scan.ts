/**
 * Local-dev manual scan trigger. Run with: npm run scan
 *
 * Hits the local dev server's /api/scan cron endpoint with CRON_SECRET from
 * .env.local, same as Vercel Cron does in production. Prints a summary of
 * posts/comments/tickers ingested so you can tell the pipeline actually did
 * something without tailing the dev-server log.
 *
 * Assumes `npm run dev` is running on PORT (default 3000). Exits non-zero on
 * failure so it's safe to chain in scripts.
 */

const PORT = process.env.PORT || '3000';
const BASE_URL = process.env.SCAN_BASE_URL || `http://localhost:${PORT}`;
const CRON_SECRET = process.env.CRON_SECRET;

async function main() {
  if (!CRON_SECRET) {
    console.error('✗ CRON_SECRET missing from .env.local — cannot auth to /api/scan.');
    process.exit(1);
  }

  const url = `${BASE_URL}/api/scan`;
  console.log(`→ GET ${url}`);

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
  } catch (err) {
    console.error(
      `✗ Network error hitting ${url} — is the dev server running? (${(err as Error).message})`
    );
    process.exit(1);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: {
      subreddits?: string[];
      totalPosts?: number;
      totalComments?: number;
      totalUniqueTickers?: number;
      totalMentions?: number;
    };
  };

  if (!res.ok || !body.success) {
    console.error(`✗ Scan failed (${res.status}) in ${elapsed}s: ${body.error ?? res.statusText}`);
    process.exit(1);
  }

  const s = body.data;
  if (!s) {
    console.log(`✓ Scan succeeded in ${elapsed}s (no summary returned)`);
    return;
  }

  console.log(
    `✓ Scan succeeded in ${elapsed}s — ` +
      `${s.subreddits?.length ?? 0} subreddits, ` +
      `${s.totalPosts ?? 0} posts, ` +
      `${s.totalComments ?? 0} comments, ` +
      `${s.totalUniqueTickers ?? 0} unique tickers, ` +
      `${s.totalMentions ?? 0} mentions`
  );
}

main().catch(err => {
  console.error('✗ Unexpected error:', err);
  process.exit(1);
});
