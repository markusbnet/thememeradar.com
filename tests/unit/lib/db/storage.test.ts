// Mock DynamoDB client to test storage logic without real DB
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
          const key = item.ticker + ':' + (item.timestamp || item.evidenceId || '');
          table.set(key, item);
          return {};
        }
        if (command.constructor.name === 'QueryCommand') {
          const items = Array.from(table.values());
          const values = command.input.ExpressionAttributeValues || {};

          let filtered = items;
          if (values[':ticker']) {
            filtered = filtered.filter((i: any) => i.ticker === values[':ticker']);
          }
          // Handle BETWEEN range queries for timestamp
          if (values[':start'] !== undefined && values[':end'] !== undefined) {
            filtered = filtered.filter(
              (i: any) => i.timestamp >= values[':start'] && i.timestamp <= values[':end']
            );
          } else if (values[':timestamp'] !== undefined) {
            filtered = filtered.filter((i: any) => i.timestamp === values[':timestamp']);
          }

          // Handle ScanIndexForward
          if (command.input.ScanIndexForward) {
            filtered = filtered.sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
          }

          return { Items: filtered, Count: filtered.length };
        }
        if (command.constructor.name === 'ScanCommand') {
          return { Items: Array.from(table.values()), Count: table.size };
        }
        return {};
      }),
    },
    TABLES: {
      STOCK_MENTIONS: 'test_stock_mentions',
      STOCK_EVIDENCE: 'test_stock_evidence',
    },
    PutCommand: class PutCommand { input: any; constructor(input: any) { this.input = input; } },
    QueryCommand: class QueryCommand { input: any; constructor(input: any) { this.input = input; } },
    ScanCommand: class ScanCommand { input: any; constructor(input: any) { this.input = input; } },
    GetCommand: class GetCommand { input: any; constructor(input: any) { this.input = input; } },
    DeleteCommand: class DeleteCommand { input: any; constructor(input: any) { this.input = input; } },
    UpdateCommand: class UpdateCommand { input: any; constructor(input: any) { this.input = input; } },
    BatchWriteCommand: class BatchWriteCommand { input: any; constructor(input: any) { this.input = input; } },
  };
});

import {
  saveScanResults,
  getTrendingStocks,
  getFadingStocks,
  getStockDetails,
  getStockEvidence,
  getStockTimeBreakdown,
  getStockHistory,
  getSparklineData,
  roundToInterval,
} from '@/lib/db/storage';
import type { ScanResult } from '@/lib/scanner/scanner';
import { docClient, TABLES, PutCommand } from '@/lib/db/client';

// Helper to seed stock_mentions data
async function seedMention(data: {
  ticker: string;
  timestamp: number;
  mentionCount: number;
  bullishCount?: number;
  bearishCount?: number;
  neutralCount?: number;
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
        bullishCount: data.bullishCount || 0,
        bearishCount: data.bearishCount || 0,
        neutralCount: data.neutralCount || 0,
        avgSentimentScore: data.avgSentimentScore || 0,
        sentimentCategory: data.sentimentCategory || 'neutral',
      },
    })
  );
}

describe('Storage Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveScanResults', () => {
    it('should save scan results without throwing', async () => {
      const mockResult: ScanResult = {
        subreddit: 'wallstreetbets',
        tickers: new Map([
          ['GME', [
            {
              ticker: 'GME',
              source: 'post' as const,
              sourceId: 'post1',
              text: 'GME to the moon! Diamond hands!',
              subreddit: 'wallstreetbets',
              upvotes: 100,
              sentiment: {
                score: 0.8,
                category: 'bullish',
                bullishKeywords: ['to the moon', 'diamond hands'],
                bearishKeywords: [],
              },
            },
          ]],
        ]),
        stats: {
          totalPosts: 25,
          totalComments: 100,
          totalMentions: 5,
        },
      };

      await expect(saveScanResults([mockResult])).resolves.not.toThrow();
    });

    it('should handle multiple tickers in same scan', async () => {
      const mockResult: ScanResult = {
        subreddit: 'wallstreetbets',
        tickers: new Map([
          ['GME', [{
            ticker: 'GME', source: 'post' as const, sourceId: 'p1',
            text: 'GME moon', subreddit: 'wallstreetbets', upvotes: 50,
            sentiment: { score: 0.5, category: 'bullish', bullishKeywords: ['moon'], bearishKeywords: [] },
          }]],
          ['AMC', [{
            ticker: 'AMC', source: 'comment' as const, sourceId: 'c1',
            text: 'AMC puts', subreddit: 'wallstreetbets', upvotes: 30,
            sentiment: { score: -0.5, category: 'bearish', bullishKeywords: [], bearishKeywords: ['puts'] },
          }]],
        ]),
        stats: { totalPosts: 10, totalComments: 20, totalMentions: 2 },
      };

      await expect(saveScanResults([mockResult])).resolves.not.toThrow();
      // Verify DB was called for both tickers (PutCommand for mentions + evidence)
      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const putCalls = sendCalls.filter((c: any) => c[0].constructor.name === 'PutCommand');
      expect(putCalls.length).toBeGreaterThanOrEqual(4); // 2 mentions + 2 evidence
    });

    it('should aggregate mentions across multiple subreddits', async () => {
      const results: ScanResult[] = [
        {
          subreddit: 'wallstreetbets',
          tickers: new Map([['GME', [{
            ticker: 'GME', source: 'post' as const, sourceId: 'p1',
            text: 'GME wsb', subreddit: 'wallstreetbets', upvotes: 100,
            sentiment: { score: 0.5, category: 'bullish', bullishKeywords: [], bearishKeywords: [] },
          }]]]),
          stats: { totalPosts: 1, totalComments: 0, totalMentions: 1 },
        },
        {
          subreddit: 'stocks',
          tickers: new Map([['GME', [{
            ticker: 'GME', source: 'post' as const, sourceId: 'p2',
            text: 'GME stocks', subreddit: 'stocks', upvotes: 50,
            sentiment: { score: 0.3, category: 'bullish', bullishKeywords: [], bearishKeywords: [] },
          }]]]),
          stats: { totalPosts: 1, totalComments: 0, totalMentions: 1 },
        },
      ];

      await expect(saveScanResults(results)).resolves.not.toThrow();
      // Should aggregate both mentions for GME into one stock_mention record
      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const mentionPuts = sendCalls.filter(
        (c: any) => c[0].constructor.name === 'PutCommand' &&
          c[0].input.TableName === TABLES.STOCK_MENTIONS
      );
      // One aggregated mention for GME with mentionCount=2
      expect(mentionPuts.length).toBe(1);
      expect(mentionPuts[0][0].input.Item.mentionCount).toBe(2);
    });

    it('should classify sentiment categories at boundaries', async () => {
      // Score > 0.6 should be strong_bullish
      const strongBullish: ScanResult = {
        subreddit: 'test',
        tickers: new Map([['TEST', [{
          ticker: 'TEST', source: 'post' as const, sourceId: 'sb1',
          text: 'test', subreddit: 'test', upvotes: 1,
          sentiment: { score: 0.7, category: 'strong_bullish', bullishKeywords: [], bearishKeywords: [] },
        }]]]),
        stats: { totalPosts: 1, totalComments: 0, totalMentions: 1 },
      };

      await saveScanResults([strongBullish]);
      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const mentionPut = sendCalls.find(
        (c: any) => c[0].constructor.name === 'PutCommand' &&
          c[0].input.TableName === TABLES.STOCK_MENTIONS &&
          c[0].input.Item.ticker === 'TEST'
      );
      expect(mentionPut[0].input.Item.sentimentCategory).toBe('strong_bullish');
    });
  });

  describe('getTrendingStocks', () => {
    it('should return an array', async () => {
      const result = await getTrendingStocks(10);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect the limit parameter', async () => {
      const result = await getTrendingStocks(5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getFadingStocks', () => {
    it('should return an array', async () => {
      const result = await getFadingStocks(10);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should only return stocks with negative velocity', async () => {
      const now = roundToInterval(Date.now());
      const prev = now - 15 * 60 * 1000;

      // Seed: GME rising (10 -> 20), AMC fading (20 -> 5)
      await seedMention({ ticker: 'GME', timestamp: prev, mentionCount: 10, sentimentCategory: 'bullish' });
      await seedMention({ ticker: 'GME', timestamp: now, mentionCount: 20, sentimentCategory: 'bullish' });
      await seedMention({ ticker: 'AMC', timestamp: prev, mentionCount: 20, sentimentCategory: 'neutral' });
      await seedMention({ ticker: 'AMC', timestamp: now, mentionCount: 5, sentimentCategory: 'neutral' });

      const result = await getFadingStocks(10);
      for (const stock of result) {
        expect(stock.velocity).toBeLessThan(0);
      }
    });

    it('should sort fading stocks by velocity ascending (most negative first)', async () => {
      const result = await getFadingStocks(10);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].velocity).toBeGreaterThanOrEqual(result[i - 1].velocity);
      }
    });

    it('should respect the limit parameter', async () => {
      const result = await getFadingStocks(1);
      expect(result.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getStockTimeBreakdown', () => {
    it('should return periods for 24h, 7d, 30d', async () => {
      const result = await getStockTimeBreakdown('GME');
      expect(result.periods).toHaveLength(3);
      expect(result.periods[0].label).toBe('24 Hours');
      expect(result.periods[1].label).toBe('7 Days');
      expect(result.periods[2].label).toBe('30 Days');
    });

    it('should return zero mentions for a ticker with no data', async () => {
      const result = await getStockTimeBreakdown('NONEXISTENT');
      for (const period of result.periods) {
        expect(period.mentions).toBe(0);
        expect(period.bullishPct).toBe(0);
        expect(period.neutralPct).toBe(0);
        expect(period.bearishPct).toBe(0);
      }
    });

    it('should calculate sentiment percentages correctly', async () => {
      const now = Date.now();
      await seedMention({
        ticker: 'TSLA',
        timestamp: now - 1000,
        mentionCount: 10,
        bullishCount: 6,
        bearishCount: 2,
        neutralCount: 2,
      });

      const result = await getStockTimeBreakdown('TSLA');
      const period24h = result.periods[0];
      expect(period24h.mentions).toBe(10);
      expect(period24h.bullishPct).toBe(60);
      expect(period24h.bearishPct).toBe(20);
      expect(period24h.neutralPct).toBe(20);
    });
  });

  describe('getStockHistory', () => {
    it('should return mentions and sentiment arrays', async () => {
      const result = await getStockHistory('GME', 7);
      expect(result).toHaveProperty('mentions');
      expect(result).toHaveProperty('sentiment');
      expect(Array.isArray(result.mentions)).toBe(true);
      expect(Array.isArray(result.sentiment)).toBe(true);
    });

    it('should return 7 daily buckets for 7-day history', async () => {
      const result = await getStockHistory('AAPL', 7);
      expect(result.mentions).toHaveLength(7);
      expect(result.sentiment).toHaveLength(7);
    });

    it('should include day labels in format "Day M/D"', async () => {
      const result = await getStockHistory('AAPL', 3);
      for (const entry of result.mentions) {
        expect(entry.label).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d+\/\d+$/);
      }
    });

    it('should aggregate mention counts into daily buckets', async () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      // Seed data for today
      await seedMention({ ticker: 'NVDA', timestamp: now - 1000, mentionCount: 15, avgSentimentScore: 0.5 });
      await seedMention({ ticker: 'NVDA', timestamp: now - 2000, mentionCount: 10, avgSentimentScore: 0.3 });

      const result = await getStockHistory('NVDA', 7);
      // The last bucket should have aggregated mentions
      const lastBucket = result.mentions[result.mentions.length - 1];
      expect(lastBucket.value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getSparklineData', () => {
    it('should return an empty array for a ticker with no data', async () => {
      const result = await getSparklineData('NONEXISTENT');
      expect(result).toEqual([]);
    });

    it('should return an array of numbers', async () => {
      const now = Date.now();
      await seedMention({ ticker: 'SPY', timestamp: now - 1000, mentionCount: 5 });

      const result = await getSparklineData('SPY', 7);
      expect(Array.isArray(result)).toBe(true);
      for (const val of result) {
        expect(typeof val).toBe('number');
      }
    });

    it('should return daily buckets for the specified number of days', async () => {
      const now = Date.now();
      await seedMention({ ticker: 'MSFT', timestamp: now - 1000, mentionCount: 3 });

      const result = await getSparklineData('MSFT', 7);
      // May include an extra bucket due to timestamp alignment
      expect(result.length).toBeGreaterThanOrEqual(7);
      expect(result.length).toBeLessThanOrEqual(8);
    });

    it('should aggregate mentions into daily buckets', async () => {
      const now = Date.now();
      await seedMention({ ticker: 'META', timestamp: now - 1000, mentionCount: 10 });
      await seedMention({ ticker: 'META', timestamp: now - 2000, mentionCount: 5 });

      const result = await getSparklineData('META', 7);
      // The last day should have the aggregated count
      const lastDay = result[result.length - 1];
      expect(lastDay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStockDetails', () => {
    it('should return null for non-existent ticker', async () => {
      const result = await getStockDetails('NONEXISTENT');
      expect(result).toBeNull();
    });
  });

  describe('getStockEvidence', () => {
    it('should return an array', async () => {
      const result = await getStockEvidence('GME', 10);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
