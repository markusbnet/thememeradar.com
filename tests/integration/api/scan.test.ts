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

describe('POST /api/scan', () => {
  const createRequest = (body: Record<string, unknown>) => {
    return new Request('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  beforeAll(() => {
    // Ensure Reddit credentials are set for tests
    process.env.REDDIT_CLIENT_ID = 'test-client-id';
    process.env.REDDIT_CLIENT_SECRET = 'test-client-secret';
  });

  it('should return 400 when no subreddit is provided', async () => {
    // Need to re-import after env is set
    const { POST } = await import('@/app/api/scan/route');
    const response = await POST(createRequest({}) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/subreddit/i);
  });

  it('should return 400 when subreddits is not an array', async () => {
    const { POST } = await import('@/app/api/scan/route');
    const response = await POST(createRequest({ subreddits: 'not-an-array' }) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/array/i);
  });

  it('should accept a valid subreddit parameter', async () => {
    const { POST } = await import('@/app/api/scan/route');
    const response = await POST(createRequest({ subreddit: 'wallstreetbets' }) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
