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
});
