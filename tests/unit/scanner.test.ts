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

describe('Scanner', () => {
  let scanner: Scanner;
  let mockRedditClient: jest.Mocked<RedditClient>;

  beforeEach(() => {
    // Create mock Reddit client instance
    mockRedditClient = {
      getHotPosts: jest.fn(),
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
  });
});
