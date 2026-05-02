/**
 * ApeWisdom direct fetch — pulls the top 100 stocks from the public API
 * and saves a snapshot to DynamoDB each scan cycle.
 *
 * ApeWisdom aggregates Reddit mentions across many more subreddits than we
 * scan directly, so it catches stocks our scanner misses.
 */

import { logger } from '@/lib/logger';
import { saveApewisdomSnapshot } from '@/lib/db/apewisdom';
import type { ApewisdomSnapshot, ApewisdomRow } from '@/types/apewisdom';

const APEWISDOM_URL = 'https://apewisdom.io/api/v1.0/filter/all-stocks/?page=1';
const SUBREDDIT_KEY = 'all-stocks';

interface ApewisdomApiResult {
  rank: number;
  ticker: string;
  name: string;
  mentions: number;
  upvotes: number;
  rank_24h_ago: number | null;
  mentions_24h_ago: number;
}

interface ApewisdomApiResponse {
  results?: ApewisdomApiResult[];
}

export async function enrichWithApewisdom(): Promise<void> {
  try {
    const res = await fetch(APEWISDOM_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      logger.warn(`[ApeWisdom] Fetch failed: ${res.status}`);
      return;
    }

    const json = await res.json() as ApewisdomApiResponse;
    if (!Array.isArray(json.results) || json.results.length === 0) {
      logger.warn('[ApeWisdom] Empty or unexpected response');
      return;
    }

    const fetchedAt = Date.now();
    const rows: ApewisdomRow[] = json.results.map(r => ({
      rank: r.rank,
      rank_24h_ago: r.rank_24h_ago ?? null,
      ticker: r.ticker.toUpperCase(),
      name: r.name ?? '',
      mentions: r.mentions,
      mentions_24h_ago: r.mentions_24h_ago ?? 0,
      upvotes: r.upvotes ?? 0,
    }));

    const snapshot: ApewisdomSnapshot = {
      subreddit: SUBREDDIT_KEY,
      fetchedAt,
      rows,
      ttl: Math.floor((fetchedAt + 48 * 60 * 60 * 1000) / 1000),
    };

    await saveApewisdomSnapshot(snapshot);
    logger.info(`[ApeWisdom] Saved ${rows.length} rows`);
  } catch (error: unknown) {
    logger.warn('[ApeWisdom] Enrichment failed:', error instanceof Error ? error.message : error);
  }
}
