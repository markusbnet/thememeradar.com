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

          if (values[':from'] !== undefined && values[':to'] !== undefined) {
            filtered = filtered.filter(
              (i: any) => i.timestamp >= values[':from'] && i.timestamp <= values[':to']
            );
          }

          if (command.input.ScanIndexForward === false) {
            filtered = filtered.sort((a: any, b: any) => b.timestamp - a.timestamp);
          } else {
            filtered = filtered.sort((a: any, b: any) => a.timestamp - b.timestamp);
          }

          const limit = command.input.Limit;
          if (limit) filtered = filtered.slice(0, limit);
          return { Items: filtered, Count: filtered.length };
        }
        return {};
      }),
    },
    TABLES: {
      STOCK_PRICES: 'test_stock_prices',
    },
    PutCommand: class PutCommand { input: any; constructor(i: any) { this.input = i; } },
    QueryCommand: class QueryCommand { input: any; constructor(i: any) { this.input = i; } },
  };
});

import { savePrice, getLatestPrice, getLatestPriceMap, getPriceHistory } from '@/lib/db/prices';
import type { StockPriceSnapshot } from '@/types/market';

function makeSnapshot(ticker: string, timestamp: number, fetchedAt: number, overrides: Partial<StockPriceSnapshot> = {}): StockPriceSnapshot {
  return {
    ticker,
    timestamp,
    price: 42.5,
    changePct24h: 3.2,
    volume: 1_000_000,
    dayHigh: 44.0,
    dayLow: 41.0,
    dayOpen: 41.5,
    previousClose: 41.2,
    staleness: 'fresh',
    fetchedAt,
    ttl: Math.floor(fetchedAt / 1000) + 7 * 24 * 60 * 60,
    ...overrides,
  };
}

describe('savePrice', () => {
  it('saves a snapshot without throwing', async () => {
    const snap = makeSnapshot('GME', Date.now(), Date.now());
    await expect(savePrice(snap)).resolves.not.toThrow();
  });

  it('stores the item so it can be retrieved', async () => {
    const now = Date.now();
    const snap = makeSnapshot('AMC', now, now, { price: 7.5 });
    await savePrice(snap);

    const result = await getLatestPrice('AMC');
    expect(result).not.toBeNull();
    expect(result?.ticker).toBe('AMC');
    expect(result?.price).toBe(7.5);
  });
});

describe('getLatestPrice', () => {
  it('returns null when no price exists for ticker', async () => {
    const result = await getLatestPrice('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('returns the most recent snapshot when multiple exist', async () => {
    const older = makeSnapshot('TSLA', 1000, 1000, { price: 100 });
    const newer = makeSnapshot('TSLA', 2000, 2000, { price: 200 });
    await savePrice(older);
    await savePrice(newer);

    const result = await getLatestPrice('TSLA');
    expect(result?.price).toBe(200);
    expect(result?.timestamp).toBe(2000);
  });

  it('computes staleness as fresh for data less than 15 minutes old', async () => {
    const now = Date.now();
    const snap = makeSnapshot('AAPL', now, now);
    await savePrice(snap);

    const result = await getLatestPrice('AAPL');
    expect(result?.staleness).toBe('fresh');
  });

  it('computes staleness as normal for data 15-60 minutes old', async () => {
    const fetchedAt = Date.now() - 20 * 60 * 1000;
    const snap = makeSnapshot('MSFT', fetchedAt, fetchedAt);
    await savePrice(snap);

    const result = await getLatestPrice('MSFT');
    expect(result?.staleness).toBe('normal');
  });

  it('computes staleness as grey for data 1-24 hours old', async () => {
    const fetchedAt = Date.now() - 2 * 60 * 60 * 1000;
    const snap = makeSnapshot('NVDA', fetchedAt, fetchedAt);
    await savePrice(snap);

    const result = await getLatestPrice('NVDA');
    expect(result?.staleness).toBe('grey');
  });

  it('computes staleness as drop for data older than 24 hours', async () => {
    const fetchedAt = Date.now() - 25 * 60 * 60 * 1000;
    const snap = makeSnapshot('SPY', fetchedAt, fetchedAt);
    await savePrice(snap);

    const result = await getLatestPrice('SPY');
    expect(result?.staleness).toBe('drop');
  });
});

describe('getLatestPriceMap', () => {
  it('returns an empty map when no tickers have data', async () => {
    const map = await getLatestPriceMap(['ZZZZ', 'QQQQ']);
    expect(map.size).toBe(0);
  });

  it('returns a map with entries for tickers that have data', async () => {
    const now = Date.now();
    await savePrice(makeSnapshot('META', now, now, { price: 500 }));

    const map = await getLatestPriceMap(['META', 'MISSING']);
    expect(map.has('META')).toBe(true);
    expect(map.has('MISSING')).toBe(false);
    expect(map.get('META')?.price).toBe(500);
  });

  it('handles an empty tickers array', async () => {
    const map = await getLatestPriceMap([]);
    expect(map.size).toBe(0);
  });
});

describe('getPriceHistory', () => {
  it('returns empty array when no data exists in range', async () => {
    const result = await getPriceHistory('ABSENT', 1000, 2000);
    expect(result).toEqual([]);
  });

  it('returns snapshots within the specified time range', async () => {
    const base = 5_000_000;
    await savePrice(makeSnapshot('COIN', base + 100, base + 100, { price: 10 }));
    await savePrice(makeSnapshot('COIN', base + 200, base + 200, { price: 20 }));
    await savePrice(makeSnapshot('COIN', base + 300, base + 300, { price: 30 }));

    const result = await getPriceHistory('COIN', base + 50, base + 250);
    expect(result).toHaveLength(2);
    expect(result[0].price).toBe(10);
    expect(result[1].price).toBe(20);
  });

  it('returns snapshots in ascending timestamp order', async () => {
    const base = 9_000_000;
    await savePrice(makeSnapshot('HOOD', base + 200, base + 200));
    await savePrice(makeSnapshot('HOOD', base + 100, base + 100));

    const result = await getPriceHistory('HOOD', base, base + 300);
    expect(result[0].timestamp).toBeLessThan(result[1].timestamp);
  });

  it('attaches computed staleness to each returned snapshot', async () => {
    const now = Date.now();
    await savePrice(makeSnapshot('RBLX', now, now));

    const result = await getPriceHistory('RBLX', now - 1000, now + 1000);
    expect(result.length).toBeGreaterThan(0);
    expect(['fresh', 'normal', 'grey', 'drop']).toContain(result[0].staleness);
  });
});
