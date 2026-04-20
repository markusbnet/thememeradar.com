/**
 * API→UI contract tests. For each data endpoint the dashboard consumes,
 * assert that every field the rendering component reads is present in the
 * real response shape. The component's TypeScript interface is the
 * contract; this test makes sure the wire format keeps up.
 *
 * These tests hit real DynamoDB Local (seeded inline per case) so a schema
 * drift in the handler — a renamed field, a dropped property — fails here
 * instead of silently rendering nothing in production.
 */

process.env.DYNAMODB_ENDPOINT =
  process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test';

import { docClient, TABLES, PutCommand, DeleteCommand } from '@/lib/db/client';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { GET as getTrending } from '@/app/api/stocks/trending/route';
import { GET as getSurging } from '@/app/api/stocks/surging/route';
import { GET as getOpportunities } from '@/app/api/stocks/opportunities/route';
import { GET as getEvidence } from '@/app/api/stocks/[ticker]/evidence/route';
import { clearRankSnapshotCache } from '@/lib/db/storage';

const FIFTEEN_MIN = 15 * 60 * 1000;

async function clearTable(table: string, keyNames: string[]) {
  const res = await docClient.send(new ScanCommand({ TableName: table }));
  for (const item of res.Items || []) {
    const Key: Record<string, any> = {};
    for (const k of keyNames) Key[k] = item[k];
    await docClient.send(new DeleteCommand({ TableName: table, Key }));
  }
}

async function seedTrending(ticker: string, mentions: number, score: number) {
  const now = Date.now();
  const bucket = Math.floor(now / FIFTEEN_MIN) * FIFTEEN_MIN;
  for (const [ts, count] of [
    [bucket, mentions],
    [bucket - FIFTEEN_MIN, Math.max(1, Math.floor(mentions / 4))],
  ] as const) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.STOCK_MENTIONS,
        Item: {
          ticker,
          timestamp: ts,
          mentionCount: count,
          uniquePosts: 1,
          uniqueComments: count - 1,
          avgSentimentScore: score,
          sentimentScore: score,
          sentimentCategory: score > 0.5 ? 'strong_bullish' : 'bullish',
          bullishCount: Math.floor(count * 0.7),
          bearishCount: 1,
          neutralCount: Math.floor(count * 0.2),
          totalUpvotes: count * 10,
          upvoteScore: count * 10,
          subredditBreakdown: { wallstreetbets: count },
          topKeywords: ['moon'],
          ttl: Math.floor(now / 1000) + 2592000,
        },
      })
    );
  }
}

describe('API → UI contract', () => {
  beforeEach(async () => {
    await clearTable(TABLES.STOCK_MENTIONS, ['ticker', 'timestamp']);
    await clearTable(TABLES.STOCK_EVIDENCE, ['ticker', 'evidenceId']);
    clearRankSnapshotCache();
  });

  it('GET /api/stocks/trending returns every field StockCard reads', async () => {
    await seedTrending('CONTRACT1', 50, 0.7);

    const res = await getTrending(
      new Request('http://localhost/api/stocks/trending') as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.trending)).toBe(true);
    expect(body.data.trending.length).toBeGreaterThan(0);

    const item = body.data.trending[0];
    // Every field the StockCard component destructures must be on the item.
    // If a rename lands in the API without updating StockCard, one of these
    // expectations fires here rather than silently rendering `undefined` in
    // the UI.
    expect(item).toEqual(
      expect.objectContaining({
        ticker: expect.any(String),
        mentionCount: expect.any(Number),
        sentimentScore: expect.any(Number),
        sentimentCategory: expect.any(String),
        velocity: expect.any(Number),
        timestamp: expect.any(Number),
      })
    );
    // Optional-but-consumed fields: must either be present or explicitly
    // null, never undefined (JSON drops undefined silently).
    expect(item).toHaveProperty('rankStatus');
    expect(item).toHaveProperty('coverageSource');
    expect(item).toHaveProperty('sparklineData');
  });

  it('GET /api/stocks/surging returns SurgeStock shape', async () => {
    // surging scans existing mentions — seed enough history so the surge
    // detector has data to look at. We don't assert a non-empty surge
    // here because surge detection depends on baseline windows; instead
    // assert the response shape stays loadable.
    await seedTrending('CONTRACT2', 80, 0.6);

    const res = await getSurging(
      new Request('http://localhost/api/stocks/surging') as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Dashboard reads body.data.surging — keep this field name stable.
    expect(body.data).toHaveProperty('surging');
    expect(Array.isArray(body.data.surging)).toBe(true);

    if (body.data.surging.length > 0) {
      const s = body.data.surging[0];
      expect(typeof s.ticker).toBe('string');
      expect(typeof s.mentionCount).toBe('number');
      expect(typeof s.surgeMultiplier).toBe('number');
      expect(typeof s.surgeScore).toBe('number');
      expect(typeof s.sentimentScore).toBe('number');
      expect(typeof s.sentimentCategory).toBe('string');
      expect(typeof s.detectedAt).toBe('number');
      expect(Array.isArray(s.sparklineData)).toBe(true);
    }
  });

  it('GET /api/stocks/opportunities returns OpportunityScore shape', async () => {
    await seedTrending('CONTRACT3', 60, 0.55);

    const res = await getOpportunities(
      new Request('http://localhost/api/stocks/opportunities') as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('opportunities');
    expect(Array.isArray(body.data.opportunities)).toBe(true);

    if (body.data.opportunities.length > 0) {
      const o = body.data.opportunities[0];
      expect(o).toEqual(
        expect.objectContaining({
          ticker: expect.any(String),
          score: expect.any(Number),
          signalLevel: expect.any(String),
          subScores: expect.objectContaining({
            velocity: expect.any(Number),
            sentiment: expect.any(Number),
            socialDominance: expect.any(Number),
            volumeChange: expect.any(Number),
            creatorInfluence: expect.any(Number),
          }),
        })
      );
    }
  });

  it('GET /api/stocks/[ticker]/evidence returns StoredEvidence shape', async () => {
    const ticker = 'EVIDENCE1';
    const now = Date.now();
    await docClient.send(
      new PutCommand({
        TableName: TABLES.STOCK_EVIDENCE,
        Item: {
          ticker,
          evidenceId: 'test-post-1',
          type: 'post',
          text: 'Sample',
          keywords: ['moon'],
          sentimentScore: 0.5,
          sentimentCategory: 'bullish',
          upvotes: 10,
          subreddit: 'wallstreetbets',
          redditUrl: 'https://reddit.com/sample',
          createdAt: now,
          ttl: Math.floor(now / 1000) + 2592000,
        },
      })
    );

    const res = await getEvidence(
      new Request(`http://localhost/api/stocks/${ticker}/evidence`) as any,
      { params: Promise.resolve({ ticker }) } as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const list = body.data.evidence ?? body.data;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);

    const ev = list[0];
    expect(ev).toEqual(
      expect.objectContaining({
        ticker: expect.any(String),
        type: expect.stringMatching(/post|comment/),
        text: expect.any(String),
        sentimentScore: expect.any(Number),
        upvotes: expect.any(Number),
        subreddit: expect.any(String),
      })
    );
  });
});
