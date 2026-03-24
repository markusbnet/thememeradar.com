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
          const expr = command.input.KeyConditionExpression || '';
          const values = command.input.ExpressionAttributeValues || {};

          let filtered = items;
          if (values[':ticker']) {
            filtered = filtered.filter((i: any) => i.ticker === values[':ticker']);
          }
          if (values[':timestamp'] !== undefined) {
            filtered = filtered.filter((i: any) => i.timestamp === values[':timestamp']);
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
      SCAN_HISTORY: 'test_scan_history',
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

import { saveScanResults, getTrendingStocks, getStockDetails, getStockEvidence } from '@/lib/db/storage';
import type { ScanResult } from '@/lib/scanner/scanner';

describe('Storage Layer', () => {
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
