import { createScanner, Scanner, ScanResult } from '@/lib/scanner/scanner';
import { createRedditClient, RedditClient } from '@/lib/reddit/client';
import { detectTickers } from '@/lib/stock/ticker-detector';
import { analyzeSentiment } from '@/lib/sentiment/analyzer';

// Mock dependencies
jest.mock('@/lib/reddit/client');
jest.mock('@/lib/stock/ticker-detector');
jest.mock('@/lib/sentiment/analyzer');

describe('Scanner Service', () => {
  let scanner: Scanner;
  let mockRedditClient: jest.Mocked<RedditClient>;

  beforeEach(() => {
    // Create mock Reddit client
    mockRedditClient = {
      authenticate: jest.fn(),
      getHotPosts: jest.fn(),
      getComments: jest.fn(),
      isRateLimited: jest.fn().mockReturnValue(false),
      getRemainingRequests: jest.fn().mockReturnValue(100),
      clearCache: jest.fn(),
    } as any;

    (createRedditClient as jest.Mock).mockReturnValue(mockRedditClient);

    scanner = createScanner({
      clientId: 'test_id',
      clientSecret: 'test_secret',
      userAgent: 'test_agent',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create scanner with Reddit client', () => {
      expect(createRedditClient).toHaveBeenCalledWith({
        clientId: 'test_id',
        clientSecret: 'test_secret',
        userAgent: 'test_agent',
      });
    });

    it('should authenticate Reddit client on first scan', async () => {
      mockRedditClient.getHotPosts.mockResolvedValue([]);

      await scanner.scanSubreddit('wallstreetbets');

      expect(mockRedditClient.authenticate).toHaveBeenCalled();
    });
  });

  describe('scanSubreddit', () => {
    it('should scan a subreddit and return results', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'GME to the moon 🚀',
          body: 'YOLO on GME calls',
          author: 'user1',
          upvotes: 1000,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
      ];

      const mockComments = [
        {
          id: 'comment1',
          postId: 'post1',
          subreddit: 'wallstreetbets',
          body: 'GME 💎🙌',
          author: 'user2',
          upvotes: 50,
          createdAt: 1234567891,
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue(mockComments);

      (detectTickers as jest.Mock).mockReturnValue(['GME']);
      (analyzeSentiment as jest.Mock).mockReturnValue({
        ticker: 'GME',
        score: 0.8,
        category: 'strong_bullish',
        keywords: { bullish: ['🚀', 'YOLO'], bearish: [], neutral: [] },
        reasoning: 'Strong bullish sentiment',
        bullishWeight: 5,
        bearishWeight: 0,
        neutralWeight: 0,
      });

      const result = await scanner.scanSubreddit('wallstreetbets');

      expect(result).toHaveProperty('scannedAt');
      expect(result.subreddit).toBe('wallstreetbets');
      expect(result.posts).toHaveLength(1);
      expect(result.stats.totalPosts).toBe(1);
      expect(result.stats.totalComments).toBe(1);
    });

    it('should extract tickers from posts', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'GME and AMC analysis',
          body: 'Both GME and AMC are bullish',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue([]);

      (detectTickers as jest.Mock).mockReturnValue(['GME', 'AMC']);
      (analyzeSentiment as jest.Mock).mockReturnValue({
        ticker: 'GME',
        score: 0.5,
        category: 'bullish',
        keywords: { bullish: [], bearish: [], neutral: [] },
        reasoning: 'Bullish',
        bullishWeight: 2,
        bearishWeight: 0,
        neutralWeight: 0,
      });

      const result = await scanner.scanSubreddit('wallstreetbets');

      expect(detectTickers).toHaveBeenCalledWith('GME and AMC analysis Both GME and AMC are bullish');
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
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
      ];

      const mockComments = [
        {
          id: 'comment1',
          postId: 'post1',
          subreddit: 'wallstreetbets',
          body: 'TSLA is the play',
          author: 'user2',
          upvotes: 20,
          createdAt: 1234567891,
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue(mockComments);

      (detectTickers as jest.Mock)
        .mockReturnValueOnce([]) // Post has no tickers
        .mockReturnValueOnce(['TSLA']); // Comment has TSLA

      (analyzeSentiment as jest.Mock).mockReturnValue({
        ticker: 'TSLA',
        score: 0.3,
        category: 'bullish',
        keywords: { bullish: [], bearish: [], neutral: [] },
        reasoning: 'Bullish',
        bullishWeight: 1,
        bearishWeight: 0,
        neutralWeight: 0,
      });

      const result = await scanner.scanSubreddit('wallstreetbets');

      expect(detectTickers).toHaveBeenCalledWith('TSLA is the play');
      expect(result.stats.uniqueTickers).toBeGreaterThan(0);
    });

    it('should analyze sentiment for each ticker mention', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'GME 🚀🚀🚀',
          body: 'Going all in on GME',
          author: 'user1',
          upvotes: 500,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue([]);

      (detectTickers as jest.Mock).mockReturnValue(['GME']);
      (analyzeSentiment as jest.Mock).mockReturnValue({
        ticker: 'GME',
        score: 0.9,
        category: 'strong_bullish',
        keywords: { bullish: ['🚀🚀🚀'], bearish: [], neutral: [] },
        reasoning: 'Very strong bullish',
        bullishWeight: 8,
        bearishWeight: 0,
        neutralWeight: 0,
      });

      const result = await scanner.scanSubreddit('wallstreetbets');

      expect(analyzeSentiment).toHaveBeenCalledWith(
        'GME 🚀🚀🚀 Going all in on GME',
        'GME'
      );

      // Check ticker mentions include sentiment
      const tickerData = result.tickers.get('GME');
      expect(tickerData).toBeDefined();
      expect(tickerData![0].sentiment.score).toBe(0.9);
    });

    it('should respect limit parameter for posts', async () => {
      mockRedditClient.getHotPosts.mockResolvedValue([]);

      await scanner.scanSubreddit('wallstreetbets', 10);

      expect(mockRedditClient.getHotPosts).toHaveBeenCalledWith('wallstreetbets', 10);
    });

    it('should default to 25 posts if no limit specified', async () => {
      mockRedditClient.getHotPosts.mockResolvedValue([]);

      await scanner.scanSubreddit('wallstreetbets');

      expect(mockRedditClient.getHotPosts).toHaveBeenCalledWith('wallstreetbets', 25);
    });

    it('should fetch all comments for each post', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'Post 1',
          body: 'Body 1',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
        {
          id: 'post2',
          subreddit: 'wallstreetbets',
          title: 'Post 2',
          body: 'Body 2',
          author: 'user2',
          upvotes: 200,
          createdAt: 1234567891,
          url: 'https://reddit.com/r/wallstreetbets/comments/post2/',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue([]);
      (detectTickers as jest.Mock).mockReturnValue([]);

      await scanner.scanSubreddit('wallstreetbets');

      expect(mockRedditClient.getComments).toHaveBeenCalledTimes(2);
      expect(mockRedditClient.getComments).toHaveBeenCalledWith('post1');
      expect(mockRedditClient.getComments).toHaveBeenCalledWith('post2');
    });

    it('should handle posts with no tickers', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'General discussion',
          body: 'What do you think about the market?',
          author: 'user1',
          upvotes: 50,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue([]);
      (detectTickers as jest.Mock).mockReturnValue([]);

      const result = await scanner.scanSubreddit('wallstreetbets');

      expect(result.stats.uniqueTickers).toBe(0);
      expect(result.stats.totalMentions).toBe(0);
    });

    it('should calculate statistics correctly', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'GME',
          body: 'GME',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
        {
          id: 'post2',
          subreddit: 'wallstreetbets',
          title: 'AMC',
          body: 'AMC',
          author: 'user2',
          upvotes: 200,
          createdAt: 1234567891,
          url: 'https://reddit.com/r/wallstreetbets/comments/post2/',
        },
      ];

      const mockComments = [
        {
          id: 'comment1',
          postId: 'post1',
          subreddit: 'wallstreetbets',
          body: 'GME comment',
          author: 'user3',
          upvotes: 10,
          createdAt: 1234567892,
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments
        .mockResolvedValueOnce(mockComments)
        .mockResolvedValueOnce([]);

      (detectTickers as jest.Mock)
        .mockReturnValueOnce(['GME'])
        .mockReturnValueOnce(['AMC'])
        .mockReturnValueOnce(['GME']);

      (analyzeSentiment as jest.Mock).mockReturnValue({
        ticker: 'GME',
        score: 0.5,
        category: 'bullish',
        keywords: { bullish: [], bearish: [], neutral: [] },
        reasoning: 'Bullish',
        bullishWeight: 1,
        bearishWeight: 0,
        neutralWeight: 0,
      });

      const result = await scanner.scanSubreddit('wallstreetbets');

      expect(result.stats.totalPosts).toBe(2);
      expect(result.stats.totalComments).toBe(1);
      expect(result.stats.uniqueTickers).toBe(2); // GME and AMC
      expect(result.stats.totalMentions).toBe(3); // 2 from posts, 1 from comment
    });
  });

  describe('scanMultipleSubreddits', () => {
    it('should scan multiple subreddits', async () => {
      mockRedditClient.getHotPosts.mockResolvedValue([]);
      mockRedditClient.getComments.mockResolvedValue([]);

      const results = await scanner.scanMultipleSubreddits([
        'wallstreetbets',
        'stocks',
        'investing',
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].subreddit).toBe('wallstreetbets');
      expect(results[1].subreddit).toBe('stocks');
      expect(results[2].subreddit).toBe('investing');
    });

    it('should scan subreddits sequentially to respect rate limits', async () => {
      mockRedditClient.getHotPosts.mockResolvedValue([]);
      mockRedditClient.getComments.mockResolvedValue([]);

      const startTime = Date.now();
      await scanner.scanMultipleSubreddits(['wallstreetbets', 'stocks']);
      const endTime = Date.now();

      // Should take some time (not instant parallel execution)
      expect(mockRedditClient.getHotPosts).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in individual subreddit scans', async () => {
      mockRedditClient.getHotPosts
        .mockResolvedValueOnce([]) // First succeeds
        .mockRejectedValueOnce(new Error('API error')) // Second fails
        .mockResolvedValueOnce([]); // Third succeeds

      const results = await scanner.scanMultipleSubreddits([
        'wallstreetbets',
        'stocks',
        'investing',
      ]);

      // Should have results for 1st and 3rd, error info for 2nd
      expect(results).toHaveLength(3);
      expect(results[0].subreddit).toBe('wallstreetbets');
      expect(results[1].error).toBeDefined();
      expect(results[2].subreddit).toBe('investing');
    });
  });

  describe('Error Handling', () => {
    it('should handle Reddit API errors gracefully', async () => {
      mockRedditClient.getHotPosts.mockRejectedValue(new Error('Reddit API error'));

      await expect(scanner.scanSubreddit('wallstreetbets')).rejects.toThrow('Reddit API error');
    });

    it('should handle comment fetch errors for individual posts', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'Post 1',
          body: 'Body 1',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockRejectedValue(new Error('Comment fetch failed'));
      (detectTickers as jest.Mock).mockReturnValue([]);

      const result = await scanner.scanSubreddit('wallstreetbets');

      // Should still return results, but with no comments
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].comments).toHaveLength(0);
    });

    it('should handle empty results from Reddit', async () => {
      mockRedditClient.getHotPosts.mockResolvedValue([]);

      const result = await scanner.scanSubreddit('wallstreetbets');

      expect(result.posts).toHaveLength(0);
      expect(result.stats.totalPosts).toBe(0);
      expect(result.stats.totalComments).toBe(0);
    });
  });

  describe('Data Aggregation', () => {
    it('should group ticker mentions by ticker', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'GME analysis',
          body: 'GME is bullish',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
        {
          id: 'post2',
          subreddit: 'wallstreetbets',
          title: 'GME update',
          body: 'GME still strong',
          author: 'user2',
          upvotes: 200,
          createdAt: 1234567891,
          url: 'https://reddit.com/r/wallstreetbets/comments/post2/',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue([]);

      (detectTickers as jest.Mock).mockReturnValue(['GME']);
      (analyzeSentiment as jest.Mock).mockReturnValue({
        ticker: 'GME',
        score: 0.7,
        category: 'bullish',
        keywords: { bullish: [], bearish: [], neutral: [] },
        reasoning: 'Bullish',
        bullishWeight: 3,
        bearishWeight: 0,
        neutralWeight: 0,
      });

      const result = await scanner.scanSubreddit('wallstreetbets');

      const gmeMentions = result.tickers.get('GME');
      expect(gmeMentions).toBeDefined();
      expect(gmeMentions).toHaveLength(2); // 2 posts mentioning GME
    });

    it('should include source information for each mention', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'GME',
          body: 'GME',
          author: 'user1',
          upvotes: 100,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
      ];

      const mockComments = [
        {
          id: 'comment1',
          postId: 'post1',
          subreddit: 'wallstreetbets',
          body: 'AAPL',
          author: 'user2',
          upvotes: 50,
          createdAt: 1234567891,
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue(mockComments);

      (detectTickers as jest.Mock)
        .mockReturnValueOnce(['GME'])
        .mockReturnValueOnce(['AAPL']);

      (analyzeSentiment as jest.Mock).mockReturnValue({
        ticker: 'GME',
        score: 0.5,
        category: 'bullish',
        keywords: { bullish: [], bearish: [], neutral: [] },
        reasoning: 'Bullish',
        bullishWeight: 1,
        bearishWeight: 0,
        neutralWeight: 0,
      });

      const result = await scanner.scanSubreddit('wallstreetbets');

      const gmeMention = result.tickers.get('GME')![0];
      expect(gmeMention.source).toBe('post');
      expect(gmeMention.sourceId).toBe('post1');

      const aaplMention = result.tickers.get('AAPL')![0];
      expect(aaplMention.source).toBe('comment');
      expect(aaplMention.sourceId).toBe('comment1');
    });

    it('should include upvote counts in mentions', async () => {
      const mockPosts = [
        {
          id: 'post1',
          subreddit: 'wallstreetbets',
          title: 'GME',
          body: 'GME',
          author: 'user1',
          upvotes: 500,
          createdAt: 1234567890,
          url: 'https://reddit.com/r/wallstreetbets/comments/post1/',
        },
      ];

      mockRedditClient.getHotPosts.mockResolvedValue(mockPosts);
      mockRedditClient.getComments.mockResolvedValue([]);

      (detectTickers as jest.Mock).mockReturnValue(['GME']);
      (analyzeSentiment as jest.Mock).mockReturnValue({
        ticker: 'GME',
        score: 0.5,
        category: 'bullish',
        keywords: { bullish: [], bearish: [], neutral: [] },
        reasoning: 'Bullish',
        bullishWeight: 1,
        bearishWeight: 0,
        neutralWeight: 0,
      });

      const result = await scanner.scanSubreddit('wallstreetbets');

      const gmeMention = result.tickers.get('GME')![0];
      expect(gmeMention.upvotes).toBe(500);
    });
  });
});
