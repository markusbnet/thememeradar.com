/**
 * ApeWisdom coverage layer — parser and merge function.
 *
 * Merge rules:
 * - reddit + apewisdom → 'both': use our mention count, sentiment, and velocity.
 *   Fill rankDelta24h from ApeWisdom only when ours is null.
 * - reddit only → 'reddit': our data unchanged.
 * - apewisdom only → 'apewisdom': their mention count, velocity proxy, sentiment=null.
 * - Stale snapshot (> 3h old): skip merge entirely, return ourStocks as 'reddit'.
 *
 * Sort order:
 * 1. 'reddit'/'both' before 'apewisdom' when primary sort values within 5% of each other.
 * 2. By |velocity| descending (our velocity for reddit/both, their proxy for apewisdom-only).
 * 3. Tie-break: mention count descending.
 * 4. Final tie-break: ticker alphabetical.
 */

import type { TrendingStock } from '@/lib/db/storage';
import type {
  ApewisdomIngestPayload,
  ApewisdomRow,
  ApewisdomSnapshot,
  CoverageSource,
} from '@/types/apewisdom';

export interface MergedTrendingStock extends TrendingStock {
  coverageSource: CoverageSource;
}

const THREE_HOURS = 3 * 60 * 60 * 1000;

export function parseApewisdomPayload(payload: ApewisdomIngestPayload): ApewisdomSnapshot {
  if (!payload.subreddit || typeof payload.subreddit !== 'string') {
    throw new Error('Invalid payload: subreddit must be a non-empty string');
  }
  if (typeof payload.fetchedAt !== 'number' || isNaN(payload.fetchedAt)) {
    throw new Error('Invalid payload: fetchedAt must be a valid number');
  }
  if (!Array.isArray(payload.rows)) {
    throw new Error('Invalid payload: rows must be an array');
  }

  for (const row of payload.rows) {
    if (
      typeof row.rank !== 'number' ||
      typeof row.ticker !== 'string' ||
      typeof row.mentions !== 'number' ||
      typeof row.mentions_24h_ago !== 'number' ||
      typeof row.upvotes !== 'number' ||
      !('rank_24h_ago' in row)
    ) {
      throw new Error('Invalid payload: row is missing required fields (rank, ticker, mentions, mentions_24h_ago, upvotes, rank_24h_ago)');
    }
  }

  return {
    subreddit: payload.subreddit,
    fetchedAt: payload.fetchedAt,
    rows: payload.rows.map(row => ({
      rank: row.rank,
      rank_24h_ago: row.rank_24h_ago ?? null,
      ticker: row.ticker.toUpperCase(),
      name: (row as any).name ?? '',
      mentions: row.mentions,
      mentions_24h_ago: row.mentions_24h_ago,
      upvotes: row.upvotes,
    })),
    ttl: Math.floor((payload.fetchedAt + 48 * 60 * 60 * 1000) / 1000),
  };
}

function awVelocity(row: ApewisdomRow): number {
  if (row.mentions_24h_ago <= 0) return 0;
  return (row.mentions / row.mentions_24h_ago - 1) * 100;
}

function awRankDelta(row: ApewisdomRow): number | null {
  return row.rank_24h_ago !== null ? row.rank_24h_ago - row.rank : null;
}

export function mergeCoverage(
  ourStocks: TrendingStock[],
  apewisdomSnapshot: ApewisdomSnapshot | null,
  now: number
): MergedTrendingStock[] {
  if (!apewisdomSnapshot || now - apewisdomSnapshot.fetchedAt > THREE_HOURS) {
    return ourStocks.map(s => ({ ...s, coverageSource: 'reddit' as CoverageSource }));
  }

  const awMap = new Map<string, ApewisdomRow>();
  for (const row of apewisdomSnapshot.rows) {
    awMap.set(row.ticker, row);
  }

  const seen = new Set<string>();
  const merged: MergedTrendingStock[] = [];

  for (const stock of ourStocks) {
    const key = stock.ticker.toUpperCase();
    seen.add(key);
    const awRow = awMap.get(key);

    if (awRow) {
      merged.push({
        ...stock,
        coverageSource: 'both',
        rankDelta24h: stock.rankDelta24h ?? awRankDelta(awRow),
      });
    } else {
      merged.push({ ...stock, coverageSource: 'reddit' });
    }
  }

  for (const [key, awRow] of awMap) {
    if (!seen.has(key)) {
      merged.push({
        ticker: awRow.ticker,
        mentionCount: awRow.mentions,
        sentimentScore: 0,
        sentimentCategory: 'neutral',
        velocity: awVelocity(awRow),
        timestamp: apewisdomSnapshot.fetchedAt,
        rankDelta24h: awRankDelta(awRow),
        rankStatus: 'unknown',
        coverageSource: 'apewisdom',
      });
    }
  }

  merged.sort((a, b) => {
    const aApeOnly = a.coverageSource === 'apewisdom';
    const bApeOnly = b.coverageSource === 'apewisdom';
    const aVel = Math.abs(a.velocity);
    const bVel = Math.abs(b.velocity);
    const maxVel = Math.max(aVel, bVel, 1);
    const within5pct = Math.abs(aVel - bVel) / maxVel <= 0.05;

    if (within5pct && aApeOnly !== bApeOnly) {
      return aApeOnly ? 1 : -1;
    }
    if (bVel !== aVel) return bVel - aVel;
    if (b.mentionCount !== a.mentionCount) return b.mentionCount - a.mentionCount;
    return a.ticker.localeCompare(b.ticker);
  });

  return merged;
}
