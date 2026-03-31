// Mock the scanner module to avoid actual Reddit API calls
jest.mock('@/lib/scanner/scanner', () => ({
  createScanner: () => ({
    scanSubreddit: jest.fn().mockResolvedValue({
      subreddit: 'test',
      tickers: new Map(),
      stats: { totalPosts: 0, totalComments: 0, totalMentions: 0 },
    }),
    scanMultipleSubreddits: jest.fn().mockResolvedValue([]),
  }),
}));

// Mock storage to avoid DynamoDB calls
jest.mock('@/lib/db/storage', () => ({
  saveScanResults: jest.fn().mockResolvedValue(undefined),
}));

const TEST_CRON_SECRET = 'test-cron-secret-12345';

describe('/api/scan authentication', () => {
  beforeAll(() => {
    process.env.REDDIT_CLIENT_ID = 'test-client-id';
    process.env.REDDIT_CLIENT_SECRET = 'test-client-secret';
    process.env.CRON_SECRET = TEST_CRON_SECRET;
  });

  describe('POST /api/scan', () => {
    const createRequest = (body: Record<string, unknown>, authHeader?: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      return new Request('http://localhost:3000/api/scan', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    };

    it('should return 401 when no Authorization header is present', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const response = await POST(createRequest({ subreddit: 'test' }) as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/unauthorized/i);
    });

    it('should return 401 when Authorization header has wrong secret', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const response = await POST(createRequest({ subreddit: 'test' }, 'Bearer wrong-secret') as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 400 when no subreddit is provided (with valid auth)', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const response = await POST(createRequest({}, `Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/subreddit/i);
    });

    it('should return 400 when subreddits is not an array (with valid auth)', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const response = await POST(createRequest({ subreddits: 'not-an-array' }, `Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/array/i);
    });

    it('should accept a valid subreddit parameter with valid auth', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const response = await POST(createRequest({ subreddit: 'wallstreetbets' }, `Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/scan', () => {
    const createGetRequest = (authHeader?: string) => {
      const headers: Record<string, string> = {};
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      return new Request('http://localhost:3000/api/scan', {
        method: 'GET',
        headers,
      });
    };

    it('should return 401 when no Authorization header is present', async () => {
      const { GET } = await import('@/app/api/scan/route');
      const response = await GET(createGetRequest() as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/unauthorized/i);
    });

    it('should return 401 when Authorization header has wrong secret', async () => {
      const { GET } = await import('@/app/api/scan/route');
      const response = await GET(createGetRequest('Bearer wrong-secret') as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });
});
