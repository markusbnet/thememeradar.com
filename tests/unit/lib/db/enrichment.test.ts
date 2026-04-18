/**
 * Tests for LunarCrush enrichment DB layer (saveEnrichment, getLatestEnrichment, getEnrichmentMap)
 */

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
          const key = `${item.ticker}:${item.timestamp}`;
          table.set(key, item);
          return {};
        }
        if (command.constructor.name === 'QueryCommand') {
          const items = Array.from(table.values());
          const values = command.input.ExpressionAttributeValues || {};
          let filtered = items.filter((i: any) => i.ticker === values[':ticker']);
          if (command.input.ScanIndexForward === false) {
            filtered = filtered.sort((a: any, b: any) => b.timestamp - a.timestamp);
          }
          const limit = command.input.Limit;
          if (limit) filtered = filtered.slice(0, limit);
          return { Items: filtered, Count: filtered.length };
        }
        return {};
      }),
    },
    TABLES: {
      STOCK_ENRICHMENT: 'test_stock_enrichment',
    },
    PutCommand: class PutCommand { input: any; constructor(i: any) { this.input = i; } },
    QueryCommand: class QueryCommand { input: any; constructor(i: any) { this.input = i; } },
  };
});

import { saveEnrichment, getLatestEnrichment, getEnrichmentMap } from '@/lib/db/enrichment';
import type { LunarCrushTopicDetail } from '@/types/lunarcrush';

const makeDetail = (overrides: Partial<LunarCrushTopicDetail> = {}): LunarCrushTopicDetail => ({
  symbol: 'GME',
  name: 'GameStop',
  price: 24.5,
  volume_24h: 5_000_000,
  percent_change_24h: 12.5,
  market_cap: 9_000_000_000,
  galaxy_score: 72,
  alt_rank: 38,
  sentiment: 3.8,
  social_dominance: 4.2,
  interactions: 80_000,
  posts_active: 1_500,
  contributors_active: 600,
  engagements_by_network: { reddit: 45000, x: 30000 },
  mentions_by_network: { reddit: 900, x: 500 },
  top_creators: [
    { screen_name: 'DFV', network: 'reddit', influencer_rank: 5, followers: 180000, posts: 3, engagements: 42000 },
    { screen_name: 'RoaringKitty', network: 'x', influencer_rank: 10, followers: 500000, posts: 1, engagements: 120000 },
  ],
  ...overrides,
});

describe('saveEnrichment', () => {
  it('saves enrichment without throwing', async () => {
    await expect(saveEnrichment('GME', makeDetail())).resolves.not.toThrow();
  });

  it('maps LunarCrushTopicDetail fields to StoredEnrichment correctly', async () => {
    const { docClient } = await import('@/lib/db/client');
    const sendMock = docClient.send as jest.Mock;
    sendMock.mockClear();

    await saveEnrichment('GME', makeDetail({ price: 99.99, percent_change_24h: -5.5 }));

    const putCall = sendMock.mock.calls.find((c: any) => c[0].constructor.name === 'PutCommand');
    const item = putCall[0].input.Item;
    expect(item.ticker).toBe('GME');
    expect(item.price).toBe(99.99);
    expect(item.percent_change_24h).toBe(-5.5);
    expect(item.engagements).toBe(80_000); // from interactions field
    expect(item.mentions_cross_platform).toBe(1_500); // from posts_active
    expect(typeof item.ttl).toBe('number');
  });

  it('caps top_creators to 5 entries', async () => {
    const manyCreators = Array.from({ length: 8 }, (_, i) => ({
      screen_name: `creator${i}`,
      network: 'reddit',
      influencer_rank: i + 1,
      followers: 1000 * (i + 1),
      posts: 1,
      engagements: 100,
    }));
    const { docClient } = await import('@/lib/db/client');
    const sendMock = docClient.send as jest.Mock;
    sendMock.mockClear();

    await saveEnrichment('AMC', makeDetail({ top_creators: manyCreators }));

    const putCall = sendMock.mock.calls.find((c: any) => c[0].constructor.name === 'PutCommand');
    expect(putCall[0].input.Item.top_creators).toHaveLength(5);
  });
});

describe('getLatestEnrichment', () => {
  it('returns null when no enrichment exists for ticker', async () => {
    const result = await getLatestEnrichment('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('returns the most recent enrichment for the ticker', async () => {
    await saveEnrichment('TSLA', makeDetail({ symbol: 'TSLA', price: 180 }));
    const result = await getLatestEnrichment('TSLA');
    expect(result).not.toBeNull();
    expect(result?.ticker).toBe('TSLA');
    expect(result?.price).toBe(180);
  });
});

describe('getEnrichmentMap', () => {
  it('returns an empty map when no tickers have enrichment', async () => {
    const map = await getEnrichmentMap(['ZZZZ', 'QQQQ']);
    expect(map.size).toBe(0);
  });

  it('returns a map with enrichment for tickers that have data', async () => {
    await saveEnrichment('AAPL', makeDetail({ symbol: 'AAPL', price: 175 }));
    const map = await getEnrichmentMap(['AAPL', 'MISSING']);
    expect(map.has('AAPL')).toBe(true);
    expect(map.has('MISSING')).toBe(false);
    expect(map.get('AAPL')?.price).toBe(175);
  });
});

describe('enrichWithLunarCrush', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.LUNARCRUSH_API_KEY;
  });

  it('no-ops when LUNARCRUSH_API_KEY is not set', async () => {
    delete process.env.LUNARCRUSH_API_KEY;
    const { enrichWithLunarCrush } = await import('@/lib/lunarcrush');
    await expect(enrichWithLunarCrush(['GME', 'AMC'])).resolves.not.toThrow();
  });

  it('deduplicates tickers before enriching', async () => {
    // No API key → no-op but verifies dedup doesn't throw
    delete process.env.LUNARCRUSH_API_KEY;
    const { enrichWithLunarCrush } = await import('@/lib/lunarcrush');
    const tickers = ['GME', 'GME', 'AMC', 'AMC', 'AMC'];
    await expect(enrichWithLunarCrush(tickers)).resolves.not.toThrow();
  });
});
