// Mock storage to avoid DynamoDB calls
jest.mock('@/lib/db/storage', () => ({
  getStockEvidence: jest.fn().mockResolvedValue([
    {
      ticker: 'GME',
      evidenceId: 'post1',
      type: 'post',
      text: 'GME to the moon!',
      keywords: ['to the moon'],
      sentimentScore: 0.8,
      upvotes: 100,
      subreddit: 'wallstreetbets',
      redditUrl: 'https://reddit.com/r/wallstreetbets/123',
    },
  ]),
}));

import { GET } from '@/app/api/stocks/[ticker]/evidence/route';
import { getStockEvidence } from '@/lib/db/storage';

function createRequest(ticker: string, limit?: string): [Request, { params: Promise<{ ticker: string }> }] {
  const url = limit
    ? `http://localhost:3000/api/stocks/${ticker}/evidence?limit=${limit}`
    : `http://localhost:3000/api/stocks/${ticker}/evidence`;
  const req = new Request(url);
  return [req, { params: Promise.resolve({ ticker }) }];
}

describe('GET /api/stocks/:ticker/evidence', () => {
  it('should return 200 with evidence data', async () => {
    const [req, ctx] = createRequest('GME');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.ticker).toBe('GME');
    expect(Array.isArray(data.data.evidence)).toBe(true);
  });

  it('should uppercase the ticker', async () => {
    const [req, ctx] = createRequest('gme');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(data.data.ticker).toBe('GME');
  });

  it('should include count and limit in response', async () => {
    const [req, ctx] = createRequest('GME');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(data.data.count).toBeDefined();
    expect(data.data.limit).toBe(10);
  });

  it('should respect limit parameter', async () => {
    const [req, ctx] = createRequest('GME', '5');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(data.data.limit).toBe(5);
  });

  it('should cap limit at 50', async () => {
    const [req, ctx] = createRequest('GME', '100');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(data.data.limit).toBe(50);
  });

  it('should return evidence items with correct structure', async () => {
    const mockEvidence = [
      {
        ticker: 'GME',
        evidenceId: 'post1',
        type: 'post',
        text: 'GME to the moon! Diamond hands!',
        keywords: ['to the moon', 'diamond hands'],
        sentimentScore: 0.8,
        upvotes: 500,
        subreddit: 'wallstreetbets',
      },
      {
        ticker: 'GME',
        evidenceId: 'comment1',
        type: 'comment',
        text: 'Holding my GME shares, HODL!',
        keywords: ['HODL'],
        sentimentScore: 0.6,
        upvotes: 120,
        subreddit: 'stocks',
      },
    ];
    (getStockEvidence as jest.Mock).mockResolvedValueOnce(mockEvidence);

    const [req, ctx] = createRequest('GME');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.evidence).toHaveLength(2);

    const first = data.data.evidence[0];
    expect(first.ticker).toBe('GME');
    expect(first.evidenceId).toBe('post1');
    expect(first.type).toBe('post');
    expect(first.text).toBe('GME to the moon! Diamond hands!');
    expect(first.keywords).toEqual(['to the moon', 'diamond hands']);
    expect(first.sentimentScore).toBe(0.8);
    expect(first.upvotes).toBe(500);
    expect(first.subreddit).toBe('wallstreetbets');

    expect(data.data.count).toBe(2);
  });

  it('should return 500 when storage throws an error', async () => {
    (getStockEvidence as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB connection failed'));

    const [req, ctx] = createRequest('GME');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('DynamoDB connection failed');
  });

  it('should return 500 with fallback message when a non-Error is thrown', async () => {
    (getStockEvidence as jest.Mock).mockRejectedValueOnce('network timeout');

    const [req, ctx] = createRequest('GME');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch evidence');
  });

  it('should default to limit=10 when limit param is non-numeric ("abc")', async () => {
    // parseInt('abc', 10) returns NaN; the route uses (NaN || 10) which falls back to 10.
    const [req, ctx] = createRequest('GME', 'abc');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.limit).toBe(10);
  });

  it('should default to limit=10 when limit param is empty string', async () => {
    // Empty string ?limit= is truthy as a value but parseInt('') is NaN → fallback 10.
    const [req, ctx] = createRequest('GME', '');
    const response = await GET(req, ctx);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Empty string is falsy → limitParam is null → ternary picks the literal default 10.
    expect(data.data.limit).toBe(10);
  });
});
