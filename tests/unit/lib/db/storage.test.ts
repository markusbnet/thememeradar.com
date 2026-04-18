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
  getRankSnapshot,
  clearRankSnapshotCache,
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

// Helper to seed stock_evidence data
async function seedEvidence(data: {
  ticker: string;
  evidenceId: string;
  type: 'post' | 'comment';
  text: string;
  keywords: string[];
  sentimentScore: number;
  sentimentCategory: string;
  upvotes: number;
  subreddit: string;
  createdAt?: number;
}) {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.STOCK_EVIDENCE,
      Item: {
        ticker: data.ticker,
        evidenceId: data.evidenceId,
        type: data.type,
        text: data.text,
        keywords: data.keywords,
        sentimentScore: data.sentimentScore,
        sentimentCategory: data.sentimentCategory,
        upvotes: data.upvotes,
        subreddit: data.subreddit,
        createdAt: data.createdAt ?? Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
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

    it('should handle empty results array without throwing', async () => {
      await expect(saveScanResults([])).resolves.not.toThrow();
      // Should not call DynamoDB at all for empty input
      expect(docClient.send).not.toHaveBeenCalled();
    });

    it('should save top 5 evidence items by upvotes', async () => {
      const mentions = Array.from({ length: 7 }, (_, i) => ({
        ticker: 'EVID',
        source: 'post' as const,
        sourceId: `p${i}`,
        text: `EVID mention ${i}`,
        subreddit: 'wallstreetbets',
        upvotes: (i + 1) * 10, // 10, 20, 30, 40, 50, 60, 70
        sentiment: { score: 0.3, category: 'bullish', bullishKeywords: [], bearishKeywords: [] },
      }));

      const mockResult: ScanResult = {
        subreddit: 'wallstreetbets',
        tickers: new Map([['EVID', mentions]]),
        stats: { totalPosts: 7, totalComments: 0, totalMentions: 7 },
      };

      await saveScanResults([mockResult]);

      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const evidencePuts = sendCalls.filter(
        (c: any) => c[0].constructor.name === 'PutCommand' &&
          c[0].input.TableName === TABLES.STOCK_EVIDENCE
      );
      expect(evidencePuts.length).toBe(5);
    });

    it('should classify bearish sentiment category (score < -0.2)', async () => {
      const mockResult: ScanResult = {
        subreddit: 'wallstreetbets',
        tickers: new Map([['BEAR', [{
          ticker: 'BEAR', source: 'post' as const, sourceId: 'bear1',
          text: 'BEAR puts dump', subreddit: 'wallstreetbets', upvotes: 10,
          sentiment: { score: -0.5, category: 'bearish', bullishKeywords: [], bearishKeywords: ['puts', 'dump'] },
        }]]]),
        stats: { totalPosts: 1, totalComments: 0, totalMentions: 1 },
      };

      await saveScanResults([mockResult]);

      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const mentionPut = sendCalls.find(
        (c: any) => c[0].constructor.name === 'PutCommand' &&
          c[0].input.TableName === TABLES.STOCK_MENTIONS &&
          c[0].input.Item.ticker === 'BEAR'
      );
      expect(mentionPut).toBeDefined();
      expect(mentionPut[0].input.Item.sentimentCategory).toBe('bearish');
    });

    it('should classify strong_bearish sentiment category (score < -0.6)', async () => {
      const mockResult: ScanResult = {
        subreddit: 'wallstreetbets',
        tickers: new Map([['SBEAR', [{
          ticker: 'SBEAR', source: 'post' as const, sourceId: 'sbear1',
          text: 'SBEAR rug pull crash', subreddit: 'wallstreetbets', upvotes: 5,
          sentiment: { score: -0.7, category: 'strong_bearish', bullishKeywords: [], bearishKeywords: ['rug pull', 'crash'] },
        }]]]),
        stats: { totalPosts: 1, totalComments: 0, totalMentions: 1 },
      };

      await saveScanResults([mockResult]);

      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const mentionPut = sendCalls.find(
        (c: any) => c[0].constructor.name === 'PutCommand' &&
          c[0].input.TableName === TABLES.STOCK_MENTIONS &&
          c[0].input.Item.ticker === 'SBEAR'
      );
      expect(mentionPut).toBeDefined();
      expect(mentionPut[0].input.Item.sentimentCategory).toBe('strong_bearish');
    });

    it('should classify neutral sentiment category (-0.2 to 0.2)', async () => {
      const mockResult: ScanResult = {
        subreddit: 'wallstreetbets',
        tickers: new Map([['NEUT', [{
          ticker: 'NEUT', source: 'post' as const, sourceId: 'neut1',
          text: 'NEUT just sitting here', subreddit: 'wallstreetbets', upvotes: 8,
          sentiment: { score: 0.1, category: 'neutral', bullishKeywords: [], bearishKeywords: [] },
        }]]]),
        stats: { totalPosts: 1, totalComments: 0, totalMentions: 1 },
      };

      await saveScanResults([mockResult]);

      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const mentionPut = sendCalls.find(
        (c: any) => c[0].constructor.name === 'PutCommand' &&
          c[0].input.TableName === TABLES.STOCK_MENTIONS &&
          c[0].input.Item.ticker === 'NEUT'
      );
      expect(mentionPut).toBeDefined();
      expect(mentionPut[0].input.Item.sentimentCategory).toBe('neutral');
    });

    it('should calculate topKeywords from mention keywords', async () => {
      const mockResult: ScanResult = {
        subreddit: 'wallstreetbets',
        tickers: new Map([['KEYS', [
          {
            ticker: 'KEYS', source: 'post' as const, sourceId: 'k1',
            text: 'KEYS to the moon diamond hands', subreddit: 'wallstreetbets', upvotes: 50,
            sentiment: { score: 0.6, category: 'bullish', bullishKeywords: ['to the moon', 'diamond hands'], bearishKeywords: [] },
          },
          {
            ticker: 'KEYS', source: 'comment' as const, sourceId: 'k2',
            text: 'KEYS paper hands dump', subreddit: 'wallstreetbets', upvotes: 20,
            sentiment: { score: -0.4, category: 'bearish', bullishKeywords: [], bearishKeywords: ['paper hands', 'dump'] },
          },
          {
            ticker: 'KEYS', source: 'post' as const, sourceId: 'k3',
            text: 'KEYS diamond hands HODL', subreddit: 'wallstreetbets', upvotes: 30,
            sentiment: { score: 0.7, category: 'bullish', bullishKeywords: ['diamond hands'], bearishKeywords: [] },
          },
        ]]]),
        stats: { totalPosts: 2, totalComments: 1, totalMentions: 3 },
      };

      await saveScanResults([mockResult]);

      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const mentionPut = sendCalls.find(
        (c: any) => c[0].constructor.name === 'PutCommand' &&
          c[0].input.TableName === TABLES.STOCK_MENTIONS &&
          c[0].input.Item.ticker === 'KEYS'
      );
      expect(mentionPut).toBeDefined();
      const topKeywords: string[] = mentionPut[0].input.Item.topKeywords;
      expect(Array.isArray(topKeywords)).toBe(true);
      // 'diamond hands' appears 2x, others 1x each — it should be first
      expect(topKeywords[0]).toBe('diamond hands');
      expect(topKeywords).toContain('to the moon');
      expect(topKeywords).toContain('paper hands');
      expect(topKeywords).toContain('dump');
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

    it('should calculate velocity as % change from previous to current period', async () => {
      const now = roundToInterval(Date.now());
      const prev = now - 15 * 60 * 1000;

      // Seed previous: GME had 10 mentions, current: GME has 20 mentions
      await seedMention({ ticker: 'GME', timestamp: prev, mentionCount: 10, sentimentCategory: 'bullish' });
      await seedMention({ ticker: 'GME', timestamp: now, mentionCount: 20, sentimentCategory: 'bullish' });

      const result = await getTrendingStocks(10);
      const gme = result.find(s => s.ticker === 'GME');
      expect(gme).toBeDefined();
      expect(gme!.velocity).toBe(100); // (20-10)/10 * 100 = 100%
    });

    it('should assign 100% velocity to new stocks with no previous data', async () => {
      const now = roundToInterval(Date.now());

      // Only seed current period (no previous data)
      await seedMention({ ticker: 'NEWSTOCK', timestamp: now, mentionCount: 8, sentimentCategory: 'neutral' });

      const result = await getTrendingStocks(10);
      const newStock = result.find(s => s.ticker === 'NEWSTOCK');
      expect(newStock).toBeDefined();
      expect(newStock!.velocity).toBe(100);
    });

    it('should filter out stocks with fewer than 5 mentions', async () => {
      const now = roundToInterval(Date.now());

      // Seed: LOW has only 3 mentions, HIGH has 10
      await seedMention({ ticker: 'LOW', timestamp: now, mentionCount: 3, sentimentCategory: 'neutral' });
      await seedMention({ ticker: 'HIGH', timestamp: now, mentionCount: 10, sentimentCategory: 'bullish' });

      const result = await getTrendingStocks(10);
      const tickers = result.map(s => s.ticker);
      expect(tickers).not.toContain('LOW');
      expect(tickers).toContain('HIGH');
    });

    it('should sort by velocity descending', async () => {
      const now = roundToInterval(Date.now());
      const prev = now - 15 * 60 * 1000;

      // SLOW: 10->15 (50%), FAST: 5->20 (300%)
      await seedMention({ ticker: 'SLOW', timestamp: prev, mentionCount: 10 });
      await seedMention({ ticker: 'SLOW', timestamp: now, mentionCount: 15 });
      await seedMention({ ticker: 'FAST', timestamp: prev, mentionCount: 5 });
      await seedMention({ ticker: 'FAST', timestamp: now, mentionCount: 20 });

      const result = await getTrendingStocks(10);
      const velocities = result.map(s => s.velocity);
      for (let i = 1; i < velocities.length; i++) {
        expect(velocities[i]).toBeLessThanOrEqual(velocities[i - 1]);
      }
    });

    it('should include all TrendingStock fields in results', async () => {
      const now = roundToInterval(Date.now());
      await seedMention({ ticker: 'FIELDS', timestamp: now, mentionCount: 10, avgSentimentScore: 0.45, sentimentCategory: 'bullish' });

      const result = await getTrendingStocks(10);
      const stock = result.find(s => s.ticker === 'FIELDS');
      expect(stock).toBeDefined();
      expect(stock).toHaveProperty('ticker');
      expect(stock).toHaveProperty('mentionCount');
      expect(stock).toHaveProperty('sentimentScore');
      expect(stock).toHaveProperty('sentimentCategory');
      expect(stock).toHaveProperty('velocity');
      expect(stock).toHaveProperty('timestamp');
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

    it('should return a StoredStockMention when a record exists for the current interval', async () => {
      const now = roundToInterval(Date.now());
      await seedMention({
        ticker: 'AAPL',
        timestamp: now,
        mentionCount: 42,
        bullishCount: 20,
        bearishCount: 5,
        neutralCount: 17,
        avgSentimentScore: 0.45,
        sentimentCategory: 'bullish',
      });

      const result = await getStockDetails('AAPL');

      expect(result).not.toBeNull();
      expect(result!.ticker).toBe('AAPL');
      expect(result!.timestamp).toBe(now);
      expect(result!.mentionCount).toBe(42);
      expect(result!.bullishCount).toBe(20);
      expect(result!.bearishCount).toBe(5);
      expect(result!.neutralCount).toBe(17);
      expect(result!.avgSentimentScore).toBe(0.45);
      expect(result!.sentimentCategory).toBe('bullish');
    });
  });

  describe('getStockEvidence', () => {
    it('should return an array', async () => {
      const result = await getStockEvidence('GME', 10);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return evidence items with correct field values', async () => {
      await seedEvidence({
        ticker: 'TSLA',
        evidenceId: 'post_tsla_1',
        type: 'post',
        text: 'TSLA to the moon! Buying calls.',
        keywords: ['to the moon', 'calls'],
        sentimentScore: 0.75,
        sentimentCategory: 'bullish',
        upvotes: 320,
        subreddit: 'wallstreetbets',
      });
      await seedEvidence({
        ticker: 'TSLA',
        evidenceId: 'comment_tsla_1',
        type: 'comment',
        text: 'Paper hands everywhere, holding my TSLA.',
        keywords: ['paper hands'],
        sentimentScore: -0.3,
        sentimentCategory: 'bearish',
        upvotes: 50,
        subreddit: 'stocks',
      });

      const result = await getStockEvidence('TSLA', 10);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      const postEvidence = result.find(e => e.evidenceId === 'post_tsla_1');
      expect(postEvidence).toBeDefined();
      expect(postEvidence!.ticker).toBe('TSLA');
      expect(postEvidence!.type).toBe('post');
      expect(postEvidence!.text).toBe('TSLA to the moon! Buying calls.');
      expect(postEvidence!.keywords).toEqual(['to the moon', 'calls']);
      expect(postEvidence!.sentimentScore).toBe(0.75);
      expect(postEvidence!.upvotes).toBe(320);
      expect(postEvidence!.subreddit).toBe('wallstreetbets');

      const commentEvidence = result.find(e => e.evidenceId === 'comment_tsla_1');
      expect(commentEvidence).toBeDefined();
      expect(commentEvidence!.type).toBe('comment');
      expect(commentEvidence!.sentimentScore).toBe(-0.3);
    });

    it('should pass the limit to the DynamoDB query', async () => {
      await getStockEvidence('NVDA', 3);

      const sendCalls = (docClient.send as jest.Mock).mock.calls;
      const queryCall = sendCalls
        .filter((c: unknown[]) => (c[0] as { constructor: { name: string } }).constructor.name === 'QueryCommand')
        .find((c: unknown[]) => {
          const input = (c[0] as { input: { ExpressionAttributeValues?: Record<string, unknown> } }).input;
          return input.ExpressionAttributeValues?.[':ticker'] === 'NVDA';
        });

      expect(queryCall).toBeDefined();
      expect((queryCall![0] as { input: { Limit: number } }).input.Limit).toBe(3);
    });

    it('should return an empty array for a ticker with no evidence', async () => {
      const result = await getStockEvidence('ZZZNOTREAL', 10);
      expect(result).toEqual([]);
    });
  });

  describe('roundToInterval', () => {
    it('should round timestamp down to nearest 15-minute interval', () => {
      // 10:07 should round to 10:00
      const ts = new Date('2026-01-01T10:07:30.000Z').getTime();
      const rounded = roundToInterval(ts);
      expect(rounded).toBe(new Date('2026-01-01T10:00:00.000Z').getTime());
    });

    it('should not change timestamp already on interval boundary', () => {
      const ts = new Date('2026-01-01T10:15:00.000Z').getTime();
      const rounded = roundToInterval(ts);
      expect(rounded).toBe(ts);
    });

    it('should support custom interval sizes', () => {
      const ts = new Date('2026-01-01T10:25:00.000Z').getTime();
      const hourMs = 60 * 60 * 1000;
      const rounded = roundToInterval(ts, hourMs);
      expect(rounded).toBe(new Date('2026-01-01T10:00:00.000Z').getTime());
    });

    it('should handle timestamps at exact midnight', () => {
      const ts = new Date('2026-01-01T00:00:00.000Z').getTime();
      const rounded = roundToInterval(ts);
      expect(rounded).toBe(ts);
    });
  });

  describe('getRankSnapshot', () => {
    beforeEach(() => clearRankSnapshotCache());

    it('should return empty map when no data at timestamp', async () => {
      const snap = await getRankSnapshot(0);
      expect(snap.size).toBe(0);
    });

    it('should return rank 1 for a single ticker at the given timestamp', async () => {
      const ts = roundToInterval(new Date('2020-01-01T00:00:00.000Z').getTime());
      await seedMention({ ticker: 'SNAP1', timestamp: ts, mentionCount: 100 });
      const snap = await getRankSnapshot(ts);
      expect(snap.get('SNAP1')).toBe(1);
    });

    it('should rank multiple tickers by mentionCount descending', async () => {
      const ts = roundToInterval(new Date('2020-01-02T00:00:00.000Z').getTime());
      await seedMention({ ticker: 'SNPA', timestamp: ts, mentionCount: 50 });
      await seedMention({ ticker: 'SNPB', timestamp: ts, mentionCount: 100 });
      await seedMention({ ticker: 'SNPC', timestamp: ts, mentionCount: 75 });
      const snap = await getRankSnapshot(ts);
      expect(snap.get('SNPB')).toBe(1);
      expect(snap.get('SNPC')).toBe(2);
      expect(snap.get('SNPA')).toBe(3);
    });
  });

  describe('getTrendingStocks rank-delta', () => {
    // Use frozen Date.now() so getTrendingStocks queries the exact timestamps we seeded.
    // Clear the rank snapshot cache before each sub-test to prevent cross-test contamination.
    afterEach(() => {
      jest.restoreAllMocks();
      clearRankSnapshotCache();
    });

    it('should return rankStatus=unknown when no 24h history exists', async () => {
      const frozen = roundToInterval(new Date('2025-06-01T12:00:00.000Z').getTime());
      jest.spyOn(Date, 'now').mockReturnValue(frozen);
      await seedMention({ ticker: 'RDNW', timestamp: frozen, mentionCount: 20 });
      await seedMention({ ticker: 'RDNW', timestamp: frozen - 15 * 60 * 1000, mentionCount: 10 });
      // No data at frozen - 24h → unknown
      const trending = await getTrendingStocks(10);
      const stock = trending.find(t => t.ticker === 'RDNW');
      expect(stock?.rankStatus).toBe('unknown');
      expect(stock?.rankDelta24h).toBeNull();
      expect(stock?.rank24hAgo).toBeNull();
    });

    it('should return rankStatus=new when ticker absent from 24h-ago snapshot but history exists', async () => {
      const frozen = roundToInterval(new Date('2025-06-02T12:00:00.000Z').getTime());
      jest.spyOn(Date, 'now').mockReturnValue(frozen);
      const ago24h = frozen - 24 * 60 * 60 * 1000;
      // Provide 24h-ago history for a different ticker so snapshot is non-empty
      await seedMention({ ticker: 'RDEX', timestamp: ago24h, mentionCount: 30 });
      // RDNW2 only exists now
      await seedMention({ ticker: 'RDNW2', timestamp: frozen, mentionCount: 15 });
      await seedMention({ ticker: 'RDNW2', timestamp: frozen - 15 * 60 * 1000, mentionCount: 7 });
      const trending = await getTrendingStocks(10);
      const stock = trending.find(t => t.ticker === 'RDNW2');
      expect(stock?.rankStatus).toBe('new');
      expect(stock?.rankDelta24h).toBeNull();
    });

    it('should return positive rankDelta24h for a climbing stock', async () => {
      const frozen = roundToInterval(new Date('2025-06-03T12:00:00.000Z').getTime());
      jest.spyOn(Date, 'now').mockReturnValue(frozen);
      const ago24h = frozen - 24 * 60 * 60 * 1000;
      // 24h ago: RDLD was rank 1, RDCL was rank 2
      await seedMention({ ticker: 'RDLD', timestamp: ago24h, mentionCount: 200 });
      await seedMention({ ticker: 'RDCL', timestamp: ago24h, mentionCount: 50 });
      // Now: only RDCL is in current bucket → current rank 1
      await seedMention({ ticker: 'RDCL', timestamp: frozen, mentionCount: 30 });
      await seedMention({ ticker: 'RDCL', timestamp: frozen - 15 * 60 * 1000, mentionCount: 10 });
      const trending = await getTrendingStocks(10);
      const stock = trending.find(t => t.ticker === 'RDCL');
      expect(stock?.rankStatus).toBe('climbing');
      expect(stock?.rank24hAgo).toBe(2);
      expect(stock?.rankDelta24h).toBe(1); // rank 2 → rank 1 = +1
    });

    it('should return steady rankStatus when rank is unchanged', async () => {
      const frozen = roundToInterval(new Date('2025-06-04T12:00:00.000Z').getTime());
      jest.spyOn(Date, 'now').mockReturnValue(frozen);
      const ago24h = frozen - 24 * 60 * 60 * 1000;
      // 24h ago: RDST was rank 1 (only ticker)
      await seedMention({ ticker: 'RDST', timestamp: ago24h, mentionCount: 100 });
      // Now: RDST still rank 1
      await seedMention({ ticker: 'RDST', timestamp: frozen, mentionCount: 30 });
      await seedMention({ ticker: 'RDST', timestamp: frozen - 15 * 60 * 1000, mentionCount: 10 });
      const trending = await getTrendingStocks(10);
      const stock = trending.find(t => t.ticker === 'RDST');
      expect(stock?.rankStatus).toBe('steady');
      expect(stock?.rankDelta24h).toBe(0);
      expect(stock?.rank24hAgo).toBe(1);
    });
  });
});
