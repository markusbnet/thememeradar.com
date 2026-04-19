/**
 * Scanner Unit Tests
 * Tests the scanner orchestration logic with mocked Reddit client
 */

import { Scanner, createScanner } from '@/lib/scanner/scanner';
import { RedditClient } from '@/lib/reddit';

// Mock only the RedditClient
jest.mock('@/lib/reddit', () => ({
  RedditClient: jest.fn(),
}));

// Also mock rate-limit so RedditCallBudget doesn't interfere
jest.mock('@/lib/rate-limit', () => {
  const actual = jest.requireActual('@/lib/rate-limit');
  return {
    ...actual,
    RedditCallBudget: jest.fn().mockImplementation(() => ({
      canMakeCall: jest.fn().mockReturnValue(true),
      recordCall: jest.fn(),
      callsUsed: 0,
      remaining: 500,
      reset: jest.fn(),
    })),
  };
});

describe('Scanner', () => {
  let scanner: Scanner;
  let mockRedditClient: jest.Mocked<RedditClient>;

  beforeEach(() => {
    // Create mock Reddit client instance
    mockRedditClient = {
      getHotPosts: jest.fn(),
      getNewPosts: jest.fn().mockResolvedValue([]),
      getRisingPosts: jest.fn().mockResolvedValue([]),
      getPostComments: jest.fn(),
    } as any;

    // Mock the RedditClient constructor
    (RedditClient as jest.Mock).mockImplementation(() => mockRedditClient);

    // Create scanner
    scanner = createScanner({
      clientId: 'test_id',
      clientSecret: 'test_secret',
      userAgent: 'test_agent',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scanSubreddit', () => {
    it('should scan a subreddit and extract tickers from posts', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: '$GME to the moon!',
          body: 'YOLO on GME calls 🚀',
          author: 'user1',
          upvotes: 1000,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getPostComments.mockResolvedValue([]);

      const result = await scanner.scanSubreddit('wallstreetbets', 1);

      expect(result.subreddit).toBe('wallstreetbets');
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].tickers).toContain('GME');
      expect(result.tickers.has('GME')).toBe(true);
      expect(result.stats.totalPosts).toBe(1);
      expect(result.stats.uniqueTickers).toBeGreaterThan(0);
    });

    it('should extract tickers from comments', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'Market discussion',
          body: 'What do you think?',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1',
        },
      ];

      const mockComments = [
        {
          id: 'comment1',
          postId: 'post1',
          subreddit: 'wallstreetbets',
          body: 'I like $TSLA and AAPL',
          author: 'user2',
          upvotes: 50,
          createdAt: 1234567891,
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getPostComments.mockResolvedValue(mockComments);

      const result = await scanner.scanSubreddit('wallstreetbets', 1);

      expect(result.tickers.has('TSLA')).toBe(true);
      expect(result.tickers.has('AAPL')).toBe(true);
      expect(result.stats.totalComments).toBe(1);
    });

    it('should analyze sentiment for ticker mentions', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: '💎🙌 $GME to the moon! 🚀',
          body: 'Diamond hands HODL!',
          author: 'user1',
          upvotes: 5000,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getPostComments.mockResolvedValue([]);

      const result = await scanner.scanSubreddit('wallstreetbets', 1);

      const gmeMentions = result.tickers.get('GME');
      expect(gmeMentions).toBeDefined();
      expect(gmeMentions!.length).toBeGreaterThan(0);
      expect(gmeMentions![0].sentiment.score).toBeGreaterThan(0); // Bullish sentiment
      expect(gmeMentions![0].sentiment.category).toMatch(/bullish/i);
    });

    it('should handle posts with no tickers', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'General discussion',
          body: 'What do you think about the market?',
          author: 'user1',
          upvotes: 10,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getPostComments.mockResolvedValue([]);

      const result = await scanner.scanSubreddit('wallstreetbets', 1);

      expect(result.stats.uniqueTickers).toBe(0);
      expect(result.tickers.size).toBe(0);
    });

    it('should handle comment fetch errors gracefully', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: '$GME discussion',
          body: 'YOLO',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getPostComments.mockRejectedValue(new Error('API error'));

      // Should not throw
      const result = await scanner.scanSubreddit('wallstreetbets', 1);

      expect(result.posts).toHaveLength(1);
      expect(result.stats.totalComments).toBe(0);
    });

    it('should handle comment fetch throwing a non-Error object gracefully', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: '$GME discussion',
          body: 'YOLO',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getPostComments.mockRejectedValue('timeout');

      // Should not throw - continues with empty comments
      const result = await scanner.scanSubreddit('wallstreetbets', 1);

      expect(result.posts).toHaveLength(1);
      expect(result.stats.totalComments).toBe(0);
    });

    it('should collect accurate statistics', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: '$GME $TSLA',
          body: 'Both going up!',
          author: 'user1',
          upvotes: 1000,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1',
        },
        {
          id: 'post2',
          subreddit: 'wallstreetbets',
          title: '$AAPL',
          body: 'New iPhone!',
          author: 'user2',
          upvotes: 500,
          createdAt: 1234567891,
          url: 'https://reddit.com/r/wallstreetbets/comments/post2',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getPostComments.mockResolvedValue([]);

      const result = await scanner.scanSubreddit('wallstreetbets', 2);

      expect(result.stats.totalPosts).toBe(2);
      expect(result.stats.uniqueTickers).toBe(3); // GME, TSLA, AAPL
      expect(result.stats.subredditBreakdown['wallstreetbets']).toBeGreaterThan(0);
    });
  });

  describe('scanMultipleSubreddits', () => {
    it('should scan multiple subreddits sequentially', async () => {
      mockRedditClient.getHotPosts.mockResolvedValue([]);
      mockRedditClient.getPostComments.mockResolvedValue([]);

      const results = await scanner.scanMultipleSubreddits(['wallstreetbets', 'stocks'], 1);

      expect(results).toHaveLength(2);
      expect(results[0].subreddit).toBe('wallstreetbets');
      expect(results[1].subreddit).toBe('stocks');
    });

    it('should continue scanning even if one subreddit fails', async () => {
      mockRedditClient.getHotPosts
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce([]);

      mockRedditClient.getPostComments.mockResolvedValue([]);

      const results = await scanner.scanMultipleSubreddits(['wallstreetbets', 'stocks'], 1);

      expect(results).toHaveLength(2);
      expect(results[0].error).toBeDefined();
      expect(results[1].error).toBeUndefined();
    });

    it('should use "Unknown error" when a non-Error object is thrown', async () => {
      mockRedditClient.getHotPosts
        .mockRejectedValueOnce('network failure')
        .mockResolvedValueOnce([]);

      mockRedditClient.getPostComments.mockResolvedValue([]);

      const results = await scanner.scanMultipleSubreddits(['wallstreetbets', 'stocks'], 1);

      expect(results).toHaveLength(2);
      expect(results[0].error).toBe('Unknown error');
      expect(results[1].error).toBeUndefined();
    });
  });
});

describe('createScanner', () => {
  beforeEach(() => {
    (RedditClient as jest.Mock).mockImplementation(() => ({
      getHotPosts: jest.fn(),
      getPostComments: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return a Scanner instance with scanSubreddit and scanMultipleSubreddits methods', () => {
    const scanner = createScanner({
      clientId: 'test_id',
      clientSecret: 'test_secret',
      userAgent: 'test_agent',
    });

    expect(scanner).toBeInstanceOf(Scanner);
    expect(typeof scanner.scanSubreddit).toBe('function');
    expect(typeof scanner.scanMultipleSubreddits).toBe('function');
  });
});

describe('Scanner — /new and /rising sweep deduplication', () => {
  let scanner: Scanner;
  let mockRedditClient: jest.Mocked<RedditClient>;

  const makePost = (id: string, ticker: string, upvotes = 10) => ({
    id,
    subreddit: 'wallstreetbets',
    title: `$${ticker} discussion`,
    body: '',
    author: 'u1',
    upvotes,
    createdAt: 1700000000,
    url: `https://reddit.com/r/wallstreetbets/comments/${id}`,
  });

  beforeEach(() => {
    mockRedditClient = {
      getHotPosts: jest.fn().mockResolvedValue([]),
      getNewPosts: jest.fn().mockResolvedValue([]),
      getRisingPosts: jest.fn().mockResolvedValue([]),
      getPostComments: jest.fn().mockResolvedValue([]),
    } as any;

    (RedditClient as jest.Mock).mockImplementation(() => mockRedditClient);

    scanner = createScanner({
      clientId: 'test_id',
      clientSecret: 'test_secret',
      userAgent: 'test_agent',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deduplicates posts that appear in both hot and new listings', async () => {
    const sharedPost = makePost('shared1', 'GME', 100);
    mockRedditClient.getHotPosts.mockResolvedValue([sharedPost]);
    mockRedditClient.getNewPosts.mockResolvedValue([sharedPost]); // same post

    const result = await scanner.scanSubreddit('wallstreetbets', 25);

    // GME should only be counted once despite appearing in two listings
    const gmeMentions = result.tickers.get('GME') || [];
    const uniqueSourceIds = new Set(gmeMentions.map(m => m.sourceId));
    expect(uniqueSourceIds.size).toBe(1);
  });

  it('includes posts from /new that are not in /hot', async () => {
    const hotPost = makePost('hot1', 'GME');
    const newPost = makePost('new1', 'BIRD', 3); // only in /new
    mockRedditClient.getHotPosts.mockResolvedValue([hotPost]);
    mockRedditClient.getNewPosts.mockResolvedValue([newPost]);

    const result = await scanner.scanSubreddit('wallstreetbets', 25);

    expect(result.tickers.has('GME')).toBe(true);
    expect(result.tickers.has('BIRD')).toBe(true);
  });

  it('includes posts from /rising that are not in /hot', async () => {
    const risingPost = makePost('rise1', 'AMC', 500);
    mockRedditClient.getHotPosts.mockResolvedValue([]);
    mockRedditClient.getRisingPosts.mockResolvedValue([risingPost]);

    const result = await scanner.scanSubreddit('wallstreetbets', 25);

    expect(result.tickers.has('AMC')).toBe(true);
  });

  it('attaches listing weight to ticker mentions', async () => {
    const risingPost = makePost('rise2', 'TSLA', 200);
    mockRedditClient.getHotPosts.mockResolvedValue([]);
    mockRedditClient.getRisingPosts.mockResolvedValue([risingPost]);

    const result = await scanner.scanSubreddit('wallstreetbets', 25);

    const mentions = result.tickers.get('TSLA') || [];
    expect(mentions.length).toBeGreaterThan(0);
    // Rising posts should have weight > 1
    expect(mentions[0].listingWeight).toBeGreaterThan(1);
  });

  it('new post mentions have weight < 1', async () => {
    const newPost = makePost('new2', 'PLTR', 2);
    mockRedditClient.getHotPosts.mockResolvedValue([]);
    mockRedditClient.getNewPosts.mockResolvedValue([newPost]);

    const result = await scanner.scanSubreddit('wallstreetbets', 25);

    const mentions = result.tickers.get('PLTR') || [];
    expect(mentions.length).toBeGreaterThan(0);
    expect(mentions[0].listingWeight).toBeLessThan(1);
  });
});
