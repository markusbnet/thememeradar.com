jest.mock('@/lib/db/client', () => {
  const store = new Map<string, Map<string, any>>();

  return {
    docClient: {
      send: jest.fn(async (command: any) => {
        const tableName = command.input?.TableName;
        if (!store.has(tableName)) store.set(tableName, new Map());
        const table = store.get(tableName)!;

        if (command.constructor.name === 'PutCommand') {
          const item = command.input.Item;
          const key = `${item.subreddit}:${item.fetchedAt}`;
          table.set(key, item);
          return {};
        }
        if (command.constructor.name === 'QueryCommand') {
          const items = Array.from(table.values());
          const values = command.input.ExpressionAttributeValues || {};
          let filtered = items.filter((i: any) => i.subreddit === values[':sub']);

          if (command.input.ScanIndexForward === false) {
            filtered = filtered.sort((a: any, b: any) => b.fetchedAt - a.fetchedAt);
          }

          const limit = command.input.Limit;
          if (limit) filtered = filtered.slice(0, limit);
          return { Items: filtered, Count: filtered.length };
        }
        return {};
      }),
    },
    TABLES: {
      APEWISDOM_SNAPSHOT: 'test_apewisdom_snapshot',
    },
    PutCommand: class PutCommand { input: any; constructor(i: any) { this.input = i; } },
    QueryCommand: class QueryCommand { input: any; constructor(i: any) { this.input = i; } },
  };
});

import { saveApewisdomSnapshot, getLatestApewisdomSnapshot } from '@/lib/db/apewisdom';
import type { ApewisdomSnapshot } from '@/types/apewisdom';

function makeSnapshot(subreddit: string, fetchedAt: number, overrides: Partial<ApewisdomSnapshot> = {}): ApewisdomSnapshot {
  return {
    subreddit,
    fetchedAt,
    rows: [
      { rank: 1, rank_24h_ago: 2, ticker: 'GME', name: 'GameStop', mentions: 150, mentions_24h_ago: 80, upvotes: 3200 },
      { rank: 2, rank_24h_ago: 1, ticker: 'AMC', name: 'AMC Entertainment', mentions: 120, mentions_24h_ago: 95, upvotes: 2100 },
    ],
    ttl: Math.floor(fetchedAt / 1000) + 48 * 60 * 60,
    ...overrides,
  };
}

describe('saveApewisdomSnapshot', () => {
  it('saves a snapshot without throwing', async () => {
    const snap = makeSnapshot('wallstreetbets', Date.now());
    await expect(saveApewisdomSnapshot(snap)).resolves.not.toThrow();
  });

  it('stores the item so it can be retrieved', async () => {
    const now = Date.now();
    const snap = makeSnapshot('stocks', now, {
      rows: [
        { rank: 1, rank_24h_ago: null, ticker: 'TSLA', name: 'Tesla', mentions: 200, mentions_24h_ago: 180, upvotes: 5000 },
      ],
    });
    await saveApewisdomSnapshot(snap);

    const result = await getLatestApewisdomSnapshot('stocks');
    expect(result).not.toBeNull();
    expect(result?.subreddit).toBe('stocks');
    expect(result?.rows[0].ticker).toBe('TSLA');
  });
});

describe('getLatestApewisdomSnapshot', () => {
  it('returns null when no snapshot exists for subreddit', async () => {
    const result = await getLatestApewisdomSnapshot('nonexistent_subreddit');
    expect(result).toBeNull();
  });

  it('returns the most recent snapshot when multiple exist for the same subreddit', async () => {
    const older = makeSnapshot('investing', 1000, {
      rows: [{ rank: 1, rank_24h_ago: null, ticker: 'OLD', name: 'OldCo', mentions: 10, mentions_24h_ago: 5, upvotes: 100 }],
    });
    const newer = makeSnapshot('investing', 2000, {
      rows: [{ rank: 1, rank_24h_ago: null, ticker: 'NEW', name: 'NewCo', mentions: 50, mentions_24h_ago: 20, upvotes: 500 }],
    });
    await saveApewisdomSnapshot(older);
    await saveApewisdomSnapshot(newer);

    const result = await getLatestApewisdomSnapshot('investing');
    expect(result?.fetchedAt).toBe(2000);
    expect(result?.rows[0].ticker).toBe('NEW');
  });

  it('preserves all rows in the snapshot', async () => {
    const now = Date.now() + 1;
    const rows = Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      rank_24h_ago: i + 2,
      ticker: `T${i}`,
      name: `Stock ${i}`,
      mentions: 100 - i * 10,
      mentions_24h_ago: 90 - i * 10,
      upvotes: 1000 - i * 100,
    }));
    await saveApewisdomSnapshot(makeSnapshot('pennystocks', now, { rows }));

    const result = await getLatestApewisdomSnapshot('pennystocks');
    expect(result?.rows).toHaveLength(5);
    expect(result?.rows[0].ticker).toBe('T0');
  });

  it('preserves the ttl field', async () => {
    const fetchedAt = Date.now() + 2;
    const expectedTtl = Math.floor(fetchedAt / 1000) + 48 * 60 * 60;
    await saveApewisdomSnapshot(makeSnapshot('options', fetchedAt, { ttl: expectedTtl }));

    const result = await getLatestApewisdomSnapshot('options');
    expect(result?.ttl).toBe(expectedTtl);
  });

  it('handles snapshots with null rank_24h_ago values', async () => {
    const now = Date.now() + 3;
    const snap = makeSnapshot('wallstreetbets_new_entries', now, {
      rows: [
        { rank: 1, rank_24h_ago: null, ticker: 'NEWCO', name: 'New Company', mentions: 300, mentions_24h_ago: 0, upvotes: 8000 },
      ],
    });
    await saveApewisdomSnapshot(snap);

    const result = await getLatestApewisdomSnapshot('wallstreetbets_new_entries');
    expect(result?.rows[0].rank_24h_ago).toBeNull();
  });
});
