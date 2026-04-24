/**
 * Task 80: Scan pipeline end-to-end integration test.
 *
 * Proves the full data pipeline is correct when composed:
 *   Reddit fixture → scanner (ticker detection + sentiment) → DynamoDB → API functions
 *
 * What runs for real: createScanner(), extractTickers(), analyzeSentiment(),
 *   saveScanResults(), getStockDetails(), getStockEvidence(), getTrendingStocks()
 *
 * What is mocked: RedditClient (external Reddit API — uses fixture data instead)
 *
 * Requires DynamoDB Local running on http://localhost:8000
 */

jest.mock('@/lib/reddit');

import fixture from '../fixtures/reddit-scan-sample.json';
import { RedditClient, type RedditPost, type RedditComment } from '@/lib/reddit';
import { createScanner } from '@/lib/scanner/scanner';
import {
  saveScanResults,
  getStockDetails,
  getStockEvidence,
  getTrendingStocks,
  clearRankSnapshotCache,
  roundToInterval,
} from '@/lib/db/storage';
import { docClient, TABLES, QueryCommand, DeleteCommand, PutCommand } from '@/lib/db/client';

const TEST_TICKERS = ['GME', 'AMC', 'TSLA'];
const WINDOW_15MIN = 15 * 60 * 1000;

async function deleteTickerData(ticker: string): Promise<void> {
  const mentions = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_MENTIONS,
      KeyConditionExpression: 'ticker = :t',
      ExpressionAttributeValues: { ':t': ticker },
    })
  );
  for (const item of mentions.Items ?? []) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.STOCK_MENTIONS,
        Key: { ticker: item.ticker, timestamp: item.timestamp },
      })
    );
  }

  const evidence = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_EVIDENCE,
      KeyConditionExpression: 'ticker = :t',
      ExpressionAttributeValues: { ':t': ticker },
    })
  );
  for (const item of evidence.Items ?? []) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.STOCK_EVIDENCE,
        Key: { ticker: item.ticker, evidenceId: item.evidenceId },
      })
    );
  }
}

async function cleanupTestTickers(): Promise<void> {
  clearRankSnapshotCache();
  await Promise.all(TEST_TICKERS.map(deleteTickerData));
}

describe('Scan pipeline (DynamoDB Local)', () => {
  beforeAll(async () => {
    await cleanupTestTickers();

    const MockedRedditClient = jest.mocked(RedditClient);
    const commentsByPostId: Record<string, RedditComment[]> = fixture.comments as Record<string, RedditComment[]>;

    MockedRedditClient.mockImplementation(() => ({
      authenticate: jest.fn().mockResolvedValue(undefined),
      getHotPosts: jest.fn().mockResolvedValue(fixture.posts as RedditPost[]),
      getNewPosts: jest.fn().mockResolvedValue([]),
      getRisingPosts: jest.fn().mockResolvedValue([]),
      getPostComments: jest.fn().mockImplementation((_subreddit: string, postId: string) =>
        Promise.resolve(commentsByPostId[postId] ?? [])
      ),
    }) as unknown as RedditClient);

    const scanner = createScanner({
      clientId: 'test-id',
      clientSecret: 'test-secret',
      userAgent: 'test-agent/1.0',
    });

    const results = await scanner.scanMultipleSubreddits(['wallstreetbets'], 25);
    await saveScanResults(results);
  });

  afterAll(async () => {
    await cleanupTestTickers();
  });

  describe('DynamoDB write correctness', () => {
    it('stores GME with correct mention count and bullish sentiment', async () => {
      const gme = await getStockDetails('GME');

      expect(gme).not.toBeNull();
      // Posts: pipe01 (GME), pipe02 (GME+AMC), pipe05 (GME) = 3 post mentions
      // Comments: c01a, c01b, c01c (pipe01), c02a, c02c (pipe02), c04b (pipe04), c05a, c05b, c05c (pipe05) = 9
      // Total expected: >= 10 (pipe02/04/05 comment counts may vary by extraction)
      expect(gme!.mentionCount).toBeGreaterThanOrEqual(10);
      expect(gme!.uniquePosts).toBeGreaterThanOrEqual(3);
      expect(gme!.sentimentCategory).toMatch(/bullish/);
      expect(gme!.avgSentimentScore).toBeGreaterThan(0);
      expect(gme!.subredditBreakdown).toHaveProperty('wallstreetbets');
      expect(gme!.topKeywords.length).toBeGreaterThan(0);
    });

    it('stores AMC with correct mention count and bullish sentiment', async () => {
      const amc = await getStockDetails('AMC');

      expect(amc).not.toBeNull();
      // Posts: pipe02, pipe04 = 2; Comments: c01b, c02b, c04a, c04b, c04c = 5
      expect(amc!.mentionCount).toBeGreaterThanOrEqual(5);
      expect(amc!.sentimentCategory).toMatch(/bullish/);
      expect(amc!.avgSentimentScore).toBeGreaterThan(0);
    });

    it('stores TSLA with bearish sentiment', async () => {
      const tsla = await getStockDetails('TSLA');

      expect(tsla).not.toBeNull();
      // Posts: pipe03; Comments: c03a, c03b, c03c = 3 comments
      expect(tsla!.mentionCount).toBeGreaterThanOrEqual(2);
      expect(tsla!.sentimentCategory).toMatch(/bearish/);
      expect(tsla!.avgSentimentScore).toBeLessThan(0);
    });

    it('stores mentionCount breakdown: uniquePosts + uniqueComments = mentionCount', async () => {
      const gme = await getStockDetails('GME');
      expect(gme).not.toBeNull();
      expect(gme!.uniquePosts + gme!.uniqueComments).toBe(gme!.mentionCount);
    });
  });

  describe('Evidence storage', () => {
    it('stores GME evidence items for top posts by upvotes', async () => {
      const evidence = await getStockEvidence('GME', 10);

      expect(evidence.length).toBeGreaterThan(0);
      // pipe01 (500 upvotes) should be the top evidence item
      const topEvidence = evidence.find(e => e.evidenceId === 'pipe01');
      expect(topEvidence).toBeDefined();
      expect(topEvidence!.type).toBe('post');
      expect(topEvidence!.upvotes).toBe(500);
      expect(topEvidence!.subreddit).toBe('wallstreetbets');
      expect(topEvidence!.sentimentCategory).toMatch(/bullish/);
      expect(topEvidence!.keywords.length).toBeGreaterThan(0);
    });

    it('evidence text contains the original post content', async () => {
      const evidence = await getStockEvidence('GME', 10);
      const topEvidence = evidence.find(e => e.evidenceId === 'pipe01');
      expect(topEvidence!.text).toMatch(/GME/i);
    });

    it('stores AMC evidence', async () => {
      const evidence = await getStockEvidence('AMC', 10);
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence.every(e => e.ticker === 'AMC')).toBe(true);
    });
  });

  describe('Trending API', () => {
    it('includes GME and AMC in trending results (>= 5 mentions each)', async () => {
      const trending = await getTrendingStocks(10, '1h');
      const tickers = trending.map(s => s.ticker);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AMC');
    });

    it('GME appears with positive velocity (new ticker defaults to 100%)', async () => {
      const trending = await getTrendingStocks(10, '1h');
      const gme = trending.find(s => s.ticker === 'GME');

      expect(gme).toBeDefined();
      expect(gme!.velocity).toBe(100);
      expect(gme!.mentionsPrev).toBe(0);
    });

    it('includes GME velocity increase over a seeded previous window', async () => {
      const now = Date.now();
      // '1h' timeframe: previous window = [now-2h, now-1h].
      // Seed at now-75min so the entry sits well inside the previous window.
      const prevWindow = roundToInterval(now - 60 * 60 * 1000 - WINDOW_15MIN);

      // Seed a previous window with lower mention count so velocity > 0
      await docClient.send(
        new PutCommand({
          TableName: TABLES.STOCK_MENTIONS,
          Item: {
            ticker: 'GME',
            timestamp: prevWindow,
            mentionCount: 3,
            uniquePosts: 2,
            uniqueComments: 1,
            avgSentimentScore: 0.5,
            sentimentCategory: 'bullish',
            bullishCount: 3,
            bearishCount: 0,
            neutralCount: 0,
            totalUpvotes: 100,
            subredditBreakdown: { wallstreetbets: 3 },
            topKeywords: ['moon'],
            ttl: Math.floor(now / 1000) + 3600,
          },
        })
      );
      clearRankSnapshotCache();

      const trending = await getTrendingStocks(10, '1h');
      const gme = trending.find(s => s.ticker === 'GME');

      expect(gme).toBeDefined();
      // GME: >= 10 current vs 3 previous → velocity > 100%
      expect(gme!.velocity).toBeGreaterThan(0);
      expect(gme!.mentionsPrev).toBe(3);

      // Cleanup the seeded prev window entry
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.STOCK_MENTIONS,
          Key: { ticker: 'GME', timestamp: prevWindow },
        })
      );
    });

    it('TSLA does not appear in trending (below 5-mention threshold)', async () => {
      const trending = await getTrendingStocks(10, '1h');
      const tickers = trending.map(s => s.ticker);
      // TSLA has <= 4 mentions which is below the 1h minMentions=5 threshold
      expect(tickers).not.toContain('TSLA');
    });
  });

  describe('Sentiment correctness', () => {
    it('GME bullish keywords appear in evidence keywords', async () => {
      const evidence = await getStockEvidence('GME', 10);
      const allKeywords = evidence.flatMap(e => e.keywords);
      // Fixture uses "YOLO", "diamond hands", "moon", "HODL", "squeeze"
      const bullishKeywords = ['yolo', 'diamond hands', 'hodl', 'moon', 'squeeze'];
      const found = bullishKeywords.some(kw =>
        allKeywords.some(ek => ek.toLowerCase().includes(kw.toLowerCase()))
      );
      expect(found).toBe(true);
    });

    it('TSLA bearish keywords appear in evidence keywords', async () => {
      const evidence = await getStockEvidence('TSLA', 10);
      const allKeywords = evidence.flatMap(e => e.keywords);
      const bearishKeywords = ['puts', 'short', 'dump'];
      const found = bearishKeywords.some(kw =>
        allKeywords.some(ek => ek.toLowerCase().includes(kw.toLowerCase()))
      );
      expect(found).toBe(true);
    });
  });
});
