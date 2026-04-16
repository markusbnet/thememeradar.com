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

import { saveScanResults } from '@/lib/db/storage';

const mockSaveScanResults = saveScanResults as jest.MockedFunction<typeof saveScanResults>;

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

    it('should accept a valid subreddits array with valid auth', async () => {
      const { POST } = await import('@/app/api/scan/route');
      const response = await POST(createRequest({ subreddits: ['wallstreetbets', 'stocks'] }, `Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 500 when Reddit credentials are missing', async () => {
      const savedClientId = process.env.REDDIT_CLIENT_ID;
      const savedClientSecret = process.env.REDDIT_CLIENT_SECRET;
      delete process.env.REDDIT_CLIENT_ID;
      delete process.env.REDDIT_CLIENT_SECRET;

      try {
        let POST: typeof import('@/app/api/scan/route').POST;
        jest.isolateModules(() => {
          ({ POST } = require('@/app/api/scan/route'));
        });
        const response = await POST!(createRequest({ subreddit: 'wallstreetbets' }, `Bearer ${TEST_CRON_SECRET}`) as any);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toMatch(/credentials/i);
      } finally {
        process.env.REDDIT_CLIENT_ID = savedClientId;
        process.env.REDDIT_CLIENT_SECRET = savedClientSecret;
      }
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

    it('should return 200 and scan results with valid auth', async () => {
      const { GET } = await import('@/app/api/scan/route');
      const response = await GET(createGetRequest(`Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.subreddits).toEqual(['wallstreetbets', 'stocks', 'investing']);
      expect(typeof data.data.totalPosts).toBe('number');
      expect(typeof data.data.totalComments).toBe('number');
      expect(typeof data.data.totalMentions).toBe('number');
    });

    it('should return 500 when Reddit credentials are missing', async () => {
      const savedClientId = process.env.REDDIT_CLIENT_ID;
      const savedClientSecret = process.env.REDDIT_CLIENT_SECRET;
      delete process.env.REDDIT_CLIENT_ID;
      delete process.env.REDDIT_CLIENT_SECRET;

      try {
        let GET: typeof import('@/app/api/scan/route').GET;
        jest.isolateModules(() => {
          ({ GET } = require('@/app/api/scan/route'));
        });
        const response = await GET!(createGetRequest(`Bearer ${TEST_CRON_SECRET}`) as any);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toMatch(/credentials/i);
      } finally {
        process.env.REDDIT_CLIENT_ID = savedClientId;
        process.env.REDDIT_CLIENT_SECRET = savedClientSecret;
      }
    });
  });

  describe('verifyCronAuth', () => {
    it('should return 401 when CRON_SECRET is not set', async () => {
      const savedCronSecret = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;

      try {
        const { GET } = await import('@/app/api/scan/route');
        const request = new Request('http://localhost:3000/api/scan', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${TEST_CRON_SECRET}` },
        });
        const response = await GET(request as any);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toMatch(/unauthorized/i);
      } finally {
        process.env.CRON_SECRET = savedCronSecret;
      }
    });
  });

  describe('POST /api/scan error handling', () => {
    beforeEach(() => {
      mockSaveScanResults.mockReset();
      mockSaveScanResults.mockResolvedValue(undefined);
    });

    const createRequest = (body: Record<string, unknown>, authHeader: string) => {
      return new Request('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(body),
      });
    };

    it('should return 500 with the error message when saveScanResults throws', async () => {
      mockSaveScanResults.mockRejectedValueOnce(new Error('DynamoDB write failed'));

      const { POST } = await import('@/app/api/scan/route');
      const response = await POST(createRequest({ subreddit: 'wallstreetbets' }, `Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('DynamoDB write failed');
    });

    it('should return 500 with fallback message when a non-Error is thrown', async () => {
      mockSaveScanResults.mockRejectedValueOnce('network failure');

      const { POST } = await import('@/app/api/scan/route');
      const response = await POST(createRequest({ subreddit: 'wallstreetbets' }, `Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('GET /api/scan error handling', () => {
    beforeEach(() => {
      mockSaveScanResults.mockReset();
      mockSaveScanResults.mockResolvedValue(undefined);
    });

    const createGetRequest = (authHeader: string) => {
      return new Request('http://localhost:3000/api/scan', {
        method: 'GET',
        headers: { 'Authorization': authHeader },
      });
    };

    it('should return 500 with the error message when saveScanResults throws', async () => {
      mockSaveScanResults.mockRejectedValueOnce(new Error('DynamoDB write failed'));

      const { GET } = await import('@/app/api/scan/route');
      const response = await GET(createGetRequest(`Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('DynamoDB write failed');
    });

    it('should return 500 with fallback message when a non-Error is thrown', async () => {
      mockSaveScanResults.mockRejectedValueOnce('network failure');

      const { GET } = await import('@/app/api/scan/route');
      const response = await GET(createGetRequest(`Bearer ${TEST_CRON_SECRET}`) as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Scan failed');
    });
  });
});
