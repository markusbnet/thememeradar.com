// jest.mock factories are hoisted by Babel before any variable declarations.
// To share state between the factory and the test body we use a module-level
// object (not a `const`/`let` reference) whose property is set inside the factory.
// `var` is also hoisted with `undefined` initialization, making it safe to reference
// inside the factory even before the assignment that runs at module scope.

// eslint-disable-next-line no-var
var __surgeTestStore: Map<string, Map<string, any>>;

jest.mock('@/lib/db/client', () => {
  // Build the store inside the factory so it exists when the factory runs.
  const store = new Map<string, Map<string, any>>();
  // Assign to the var so test helpers can reach it.
  __surgeTestStore = store;

  return {
    docClient: {
      send: jest.fn(async (command: any) => {
        const tableName = command.input?.TableName;
        if (!store.has(tableName)) store.set(tableName, new Map());
        const table = store.get(tableName)!;

        if (command.constructor.name === 'PutCommand') {
          const item = command.input.Item;
          const key = item.ticker + ':' + (item.timestamp ?? item.evidenceId ?? '');
          table.set(key, item);
          return {};
        }

        if (command.constructor.name === 'QueryCommand') {
          let filtered = Array.from(table.values());
          const values = command.input.ExpressionAttributeValues || {};

          if (values[':ticker']) {
            filtered = filtered.filter((i: any) => i.ticker === values[':ticker']);
          }

          if (values[':start'] !== undefined && values[':end'] !== undefined) {
            filtered = filtered.filter(
              (i: any) => i.timestamp >= values[':start'] && i.timestamp <= values[':end']
            );
          } else if (values[':timestamp'] !== undefined) {
            filtered = filtered.filter((i: any) => i.timestamp === values[':timestamp']);
          }

          return { Items: filtered, Count: filtered.length };
        }

        return {};
      }),
    },
    TABLES: {
      STOCK_MENTIONS: 'test_stock_mentions',
      STOCK_EVIDENCE: 'test_stock_evidence',
    },
    PutCommand: class PutCommand {
      input: any;
      constructor(input: any) { this.input = input; }
    },
    QueryCommand: class QueryCommand {
      input: any;
      constructor(input: any) { this.input = input; }
    },
    ScanCommand: class ScanCommand {
      input: any;
      constructor(input: any) { this.input = input; }
    },
    GetCommand: class GetCommand {
      input: any;
      constructor(input: any) { this.input = input; }
    },
    DeleteCommand: class DeleteCommand {
      input: any;
      constructor(input: any) { this.input = input; }
    },
    UpdateCommand: class UpdateCommand {
      input: any;
      constructor(input: any) { this.input = input; }
    },
    BatchWriteCommand: class BatchWriteCommand {
      input: any;
      constructor(input: any) { this.input = input; }
    },
  };
});

// Fixed "now" aligned to a 15-min boundary so interval math is predictable.
const INTERVAL_MS = 15 * 60 * 1000; // 900_000 ms
const FIXED_NOW = Math.floor(1_700_000_000_000 / INTERVAL_MS) * INTERVAL_MS;

jest.mock('@/lib/db/storage', () => ({
  roundToInterval: jest.fn(() => FIXED_NOW),
}));

import { computeSurgeScore, getSurgingStocks, DEFAULT_SURGE_CONFIG, SurgeConfig } from '@/lib/db/surge';
import { docClient, TABLES, PutCommand } from '@/lib/db/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clearMockStore() {
  __surgeTestStore.clear();
}

async function seedMention(data: {
  ticker: string;
  timestamp: number;
  mentionCount: number;
  avgSentimentScore?: number;
  sentimentCategory?: string;
}) {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.STOCK_MENTIONS,
      Item: {
        ticker: data.ticker,
        timestamp: data.timestamp,
        mentionCount: data.mentionCount,
        avgSentimentScore: data.avgSentimentScore ?? 0,
        sentimentCategory: data.sentimentCategory ?? 'neutral',
      },
    })
  );
}

// ─── computeSurgeScore (pure function) ───────────────────────────────────────

describe('computeSurgeScore', () => {
  it('should return null when currentMentions < minAbsoluteMentions', () => {
    const result = computeSurgeScore(3, 1, DEFAULT_SURGE_CONFIG);
    expect(result).toBeNull();
  });

  it('should return score 1.0 when baselineAvg is 0 and currentMentions >= minimum', () => {
    const result = computeSurgeScore(15, 0, DEFAULT_SURGE_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(1.0);
    expect(result!.multiplier).toBe(Infinity);
  });

  it('should return null when baselineAvg is 0 and currentMentions < minimum', () => {
    const result = computeSurgeScore(3, 0, DEFAULT_SURGE_CONFIG);
    expect(result).toBeNull();
  });

  it('should return null when multiplier < surgeMultiplier threshold', () => {
    // 15 / 10 = 1.5x, below default 3x threshold
    const result = computeSurgeScore(15, 10, DEFAULT_SURGE_CONFIG);
    expect(result).toBeNull();
  });

  it('should return valid score when multiplier equals surgeMultiplier exactly', () => {
    // 30 / 10 = 3.0x, exactly at threshold
    const result = computeSurgeScore(30, 10, DEFAULT_SURGE_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.multiplier).toBe(3);
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThanOrEqual(1);
  });

  it('should return higher score for larger multipliers (monotonically increasing)', () => {
    const score3x = computeSurgeScore(30, 10, DEFAULT_SURGE_CONFIG)!;
    const score6x = computeSurgeScore(60, 10, DEFAULT_SURGE_CONFIG)!;
    const score12x = computeSurgeScore(120, 10, DEFAULT_SURGE_CONFIG)!;

    expect(score6x.score).toBeGreaterThan(score3x.score);
    expect(score12x.score).toBeGreaterThan(score6x.score);
  });

  it('should have score bounded between 0 and 1', () => {
    const result = computeSurgeScore(10000, 10, DEFAULT_SURGE_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThanOrEqual(1);
  });

  it('should correctly calculate multiplier as currentMentions / baselineAvg', () => {
    const result = computeSurgeScore(50, 10, DEFAULT_SURGE_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.multiplier).toBe(5);
  });

  it('should respect custom config for minAbsoluteMentions', () => {
    const config: SurgeConfig = { minAbsoluteMentions: 20, surgeMultiplier: 3 };
    // 15 mentions is above default (10) but below custom (20)
    const result = computeSurgeScore(15, 3, config);
    expect(result).toBeNull();

    // 25 mentions meets custom threshold and 25/3 = 8.3x > 3x
    const result2 = computeSurgeScore(25, 3, config);
    expect(result2).not.toBeNull();
  });

  it('should respect custom config for surgeMultiplier', () => {
    const config: SurgeConfig = { minAbsoluteMentions: 10, surgeMultiplier: 5 };
    // 30/10 = 3x, below custom 5x threshold
    const result = computeSurgeScore(30, 10, config);
    expect(result).toBeNull();

    // 60/10 = 6x, above custom 5x threshold
    const result2 = computeSurgeScore(60, 10, config);
    expect(result2).not.toBeNull();
  });
});

// ─── getSurgingStocks (async, DynamoDB-backed) ───────────────────────────────

describe('getSurgingStocks', () => {
  beforeEach(() => {
    clearMockStore();
    jest.clearAllMocks();
  });

  it('returns an empty array when there are no stock mentions in the current interval', async () => {
    const result = await getSurgingStocks();
    expect(result).toEqual([]);
  });

  it('returns an empty array when current mentions are below the minimum threshold', async () => {
    // mentionCount = 5, below DEFAULT_SURGE_CONFIG.minAbsoluteMentions (10)
    await seedMention({ ticker: 'LOW', timestamp: FIXED_NOW, mentionCount: 5 });

    const result = await getSurgingStocks();
    expect(result).toEqual([]);
  });

  it('returns an empty array when the surge multiplier threshold is not reached', async () => {
    // baseline avg = (4+4+4+4)/4 = 4; current = 10; ratio = 2.5x < 3x threshold
    await seedMention({ ticker: 'FLAT', timestamp: FIXED_NOW - 4 * INTERVAL_MS, mentionCount: 4 });
    await seedMention({ ticker: 'FLAT', timestamp: FIXED_NOW - 3 * INTERVAL_MS, mentionCount: 4 });
    await seedMention({ ticker: 'FLAT', timestamp: FIXED_NOW - 2 * INTERVAL_MS, mentionCount: 4 });
    await seedMention({ ticker: 'FLAT', timestamp: FIXED_NOW - INTERVAL_MS,     mentionCount: 4 });
    await seedMention({ ticker: 'FLAT', timestamp: FIXED_NOW,                    mentionCount: 10 });

    const result = await getSurgingStocks();
    expect(result).toEqual([]);
  });

  it('returns a surging stock when current mentions spike above the 3x baseline', async () => {
    // baseline avg = (3+3+3+3)/4 = 3; current = 30; ratio = 10x > 3x
    await seedMention({ ticker: 'GME', timestamp: FIXED_NOW - 4 * INTERVAL_MS, mentionCount: 3 });
    await seedMention({ ticker: 'GME', timestamp: FIXED_NOW - 3 * INTERVAL_MS, mentionCount: 3 });
    await seedMention({ ticker: 'GME', timestamp: FIXED_NOW - 2 * INTERVAL_MS, mentionCount: 3 });
    await seedMention({ ticker: 'GME', timestamp: FIXED_NOW - INTERVAL_MS,     mentionCount: 3 });
    await seedMention({ ticker: 'GME', timestamp: FIXED_NOW,                    mentionCount: 30 });

    const result = await getSurgingStocks();
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('GME');
  });

  it('returns a surging stock when there is no baseline history (first ever mentions)', async () => {
    // No prior intervals seeded → baselineAvg = 0 → score = 1.0
    await seedMention({ ticker: 'NEW', timestamp: FIXED_NOW, mentionCount: 15 });

    const result = await getSurgingStocks();
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('NEW');
    expect(result[0].surgeScore).toBe(1.0);
  });

  it('each result contains all required SurgeStock fields with correct types', async () => {
    await seedMention({
      ticker: 'AMC',
      timestamp: FIXED_NOW,
      mentionCount: 50,
      avgSentimentScore: 0.4,
      sentimentCategory: 'bullish',
    });

    const result = await getSurgingStocks();
    expect(result).toHaveLength(1);

    const stock = result[0];
    expect(typeof stock.ticker).toBe('string');
    expect(typeof stock.surgeScore).toBe('number');
    expect(typeof stock.mentionCount).toBe('number');
    expect(typeof stock.baselineMentions).toBe('number');
    expect(typeof stock.surgeMultiplier).toBe('number');
    expect(typeof stock.sentimentScore).toBe('number');
    expect(typeof stock.sentimentCategory).toBe('string');
    expect(typeof stock.detectedAt).toBe('number');
    expect(Array.isArray(stock.sparklineData)).toBe(true);
  });

  it('populates ticker, mentionCount, sentimentScore, and sentimentCategory from the DB item', async () => {
    await seedMention({
      ticker: 'TSLA',
      timestamp: FIXED_NOW,
      mentionCount: 40,
      avgSentimentScore: 0.75,
      sentimentCategory: 'strong_bullish',
    });

    const result = await getSurgingStocks();
    expect(result).toHaveLength(1);

    const stock = result[0];
    expect(stock.ticker).toBe('TSLA');
    expect(stock.mentionCount).toBe(40);
    expect(stock.sentimentScore).toBe(0.75);
    expect(stock.sentimentCategory).toBe('strong_bullish');
  });

  it('sparklineData contains baseline counts (ascending) followed by the current count', async () => {
    await seedMention({ ticker: 'SPY', timestamp: FIXED_NOW - 4 * INTERVAL_MS, mentionCount: 2 });
    await seedMention({ ticker: 'SPY', timestamp: FIXED_NOW - 3 * INTERVAL_MS, mentionCount: 3 });
    await seedMention({ ticker: 'SPY', timestamp: FIXED_NOW - 2 * INTERVAL_MS, mentionCount: 2 });
    await seedMention({ ticker: 'SPY', timestamp: FIXED_NOW - INTERVAL_MS,     mentionCount: 3 });
    await seedMention({ ticker: 'SPY', timestamp: FIXED_NOW,                    mentionCount: 60 });

    const result = await getSurgingStocks();
    expect(result).toHaveLength(1);

    const sparkline = result[0].sparklineData;
    // 4 baseline points + 1 current = 5 entries
    expect(sparkline).toHaveLength(5);
    // Last value is the current spike
    expect(sparkline[sparkline.length - 1]).toBe(60);
    // All values are non-negative numbers
    for (const val of sparkline) {
      expect(typeof val).toBe('number');
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects the default limit of 5', async () => {
    // Seed 8 surging stocks (no baseline → score = 1.0 for all)
    const tickers = ['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH'];
    for (const ticker of tickers) {
      await seedMention({ ticker, timestamp: FIXED_NOW, mentionCount: 20 });
    }

    const result = await getSurgingStocks(); // default limit = 5
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('respects a custom limit parameter', async () => {
    const tickers = ['TA', 'TB', 'TC', 'TD', 'TE', 'TF'];
    for (const ticker of tickers) {
      await seedMention({ ticker, timestamp: FIXED_NOW, mentionCount: 20 });
    }

    const result = await getSurgingStocks(3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('returns stocks sorted by surgeScore descending (highest first)', async () => {
    // GME: no baseline → score = 1.0 (maximum possible)
    await seedMention({ ticker: 'GME', timestamp: FIXED_NOW, mentionCount: 15 });

    // AMC: baseline avg = 5, current = 30 → 6x → lower score than 1.0
    await seedMention({ ticker: 'AMC', timestamp: FIXED_NOW - 4 * INTERVAL_MS, mentionCount: 5 });
    await seedMention({ ticker: 'AMC', timestamp: FIXED_NOW - 3 * INTERVAL_MS, mentionCount: 5 });
    await seedMention({ ticker: 'AMC', timestamp: FIXED_NOW - 2 * INTERVAL_MS, mentionCount: 5 });
    await seedMention({ ticker: 'AMC', timestamp: FIXED_NOW - INTERVAL_MS,     mentionCount: 5 });
    await seedMention({ ticker: 'AMC', timestamp: FIXED_NOW,                    mentionCount: 30 });

    const result = await getSurgingStocks(10);
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Verify descending order throughout the list
    for (let i = 1; i < result.length; i++) {
      expect(result[i].surgeScore).toBeLessThanOrEqual(result[i - 1].surgeScore);
    }

    // GME (score = 1.0) should rank ahead of AMC
    const gmeIndex = result.findIndex((s) => s.ticker === 'GME');
    const amcIndex = result.findIndex((s) => s.ticker === 'AMC');
    expect(gmeIndex).toBeLessThan(amcIndex);
  });

  it('calculates baselineMentions by dividing total baseline by 4 (not by number of rows)', async () => {
    // Only 2 of 4 prior intervals have data; total = 2+4 = 6, divided by 4 = 1.5
    await seedMention({ ticker: 'NVDA', timestamp: FIXED_NOW - 2 * INTERVAL_MS, mentionCount: 2 });
    await seedMention({ ticker: 'NVDA', timestamp: FIXED_NOW - INTERVAL_MS,     mentionCount: 4 });
    await seedMention({ ticker: 'NVDA', timestamp: FIXED_NOW,                    mentionCount: 30 });

    const result = await getSurgingStocks();
    expect(result).toHaveLength(1);
    // baselineTotal = 6; divided by 4 = 1.5 (rounded to 1 decimal = 1.5)
    expect(result[0].baselineMentions).toBe(1.5);
  });

  it('sets detectedAt to the current rounded interval timestamp', async () => {
    await seedMention({ ticker: 'BB', timestamp: FIXED_NOW, mentionCount: 20 });

    const result = await getSurgingStocks();
    expect(result).toHaveLength(1);
    expect(result[0].detectedAt).toBe(FIXED_NOW);
  });

  it('uses a custom SurgeConfig when provided', async () => {
    // minAbsoluteMentions=25, surgeMultiplier=2
    const customConfig: SurgeConfig = { minAbsoluteMentions: 25, surgeMultiplier: 2 };

    // baseline avg = 5/4 = 1.25; current = 30 → 24x > 2x; 30 >= 25 min → should surge
    await seedMention({ ticker: 'AAPL', timestamp: FIXED_NOW - INTERVAL_MS, mentionCount: 5 });
    await seedMention({ ticker: 'AAPL', timestamp: FIXED_NOW,               mentionCount: 30 });

    const result = await getSurgingStocks(5, customConfig);
    expect(result.some((s) => s.ticker === 'AAPL')).toBe(true);
  });

  it('does not return a stock that meets baseline ratio but fails custom minAbsoluteMentions', async () => {
    // minAbsoluteMentions=50; current = 30 < 50 → should NOT surge
    const strictConfig: SurgeConfig = { minAbsoluteMentions: 50, surgeMultiplier: 2 };

    await seedMention({ ticker: 'MSFT', timestamp: FIXED_NOW, mentionCount: 30 });

    const result = await getSurgingStocks(5, strictConfig);
    expect(result.some((s) => s.ticker === 'MSFT')).toBe(false);
  });
});
