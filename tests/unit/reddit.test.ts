/**
 * Reddit Client Tests
 */

import { RedditClient } from '@/lib/reddit';

// Mock fetch globally
global.fetch = jest.fn();

describe('RedditClient', () => {
  let client: RedditClient;

  beforeEach(() => {
    // Set required env vars
    process.env.REDDIT_CLIENT_ID = 'test_client_id';
    process.env.REDDIT_CLIENT_SECRET = 'test_client_secret';
    process.env.REDDIT_USER_AGENT = 'TestAgent/1.0';

    client = new RedditClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    delete process.env.REDDIT_USER_AGENT;
  });

  describe('constructor', () => {
    it('should throw error if credentials are missing', () => {
      delete process.env.REDDIT_CLIENT_ID;
      delete process.env.REDDIT_CLIENT_SECRET;

      expect(() => new RedditClient()).toThrow('Reddit API credentials not configured');
    });

    it('should initialize with valid credentials', () => {
      expect(() => new RedditClient()).not.toThrow();
    });
  });

  describe('authenticate', () => {
    it('should reuse cached token when not expired', async () => {
      // First call - performs OAuth
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'cached_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });
      // Mock posts response for first call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { children: [] } }),
      });

      await client.getHotPosts('wallstreetbets');

      // Second call - should reuse cached token, not call OAuth again
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { children: [] } }),
      });

      await client.getHotPosts('stocks');

      // fetch should have been called 3 times total: OAuth + posts + posts
      // (not 4, which would mean OAuth was called again)
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
        'https://www.reddit.com/api/v1/access_token'
      );
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(
        'oauth.reddit.com/r/wallstreetbets'
      );
      expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain(
        'oauth.reddit.com/r/stocks'
      );
    });

    it('should throw when authentication fails with non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid credentials',
      });

      await expect(client.getHotPosts('wallstreetbets')).rejects.toThrow(
        'Reddit OAuth failed: Unauthorized'
      );
    });
  });

  describe('getHotPosts', () => {
    it('should fetch and parse hot posts from subreddit', async () => {
      // Mock OAuth response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      // Mock posts response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  id: 'post123',
                  subreddit: 'wallstreetbets',
                  title: '$GME to the moon!',
                  selftext: 'Diamond hands!',
                  author: 'testuser',
                  ups: 1000,
                  created_utc: 1234567890,
                  permalink: '/r/wallstreetbets/comments/post123',
                },
              },
            ],
          },
        }),
      });

      const posts = await client.getHotPosts('wallstreetbets', 25);

      expect(posts).toHaveLength(1);
      expect(posts[0]).toEqual({
        id: 'post123',
        subreddit: 'wallstreetbets',
        title: '$GME to the moon!',
        body: 'Diamond hands!',
        author: 'testuser',
        upvotes: 1000,
        createdAt: 1234567890,
        url: 'https://reddit.com/r/wallstreetbets/comments/post123',
      });
    });

    it('should handle empty posts', async () => {
      // Mock OAuth
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      // Mock empty response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [],
          },
        }),
      });

      const posts = await client.getHotPosts('wallstreetbets');
      expect(posts).toEqual([]);
    });

    it('should throw when posts request returns non-ok response', async () => {
      // Mock OAuth success
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      // Mock non-ok posts response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(client.getHotPosts('wallstreetbets')).rejects.toThrow(
        'Failed to fetch posts from r/wallstreetbets: Forbidden'
      );
    });
  });

  describe('getPostComments', () => {
    it('should fetch and parse comments from a post', async () => {
      // Mock OAuth
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      // Mock comments response (Reddit returns [post, comments])
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { data: { children: [] } }, // post
          {
            data: {
              children: [
                {
                  data: {
                    id: 'comment1',
                    subreddit: 'wallstreetbets',
                    body: 'HODL!',
                    author: 'commenter1',
                    ups: 50,
                    created_utc: 1234567900,
                  },
                },
                {
                  data: {
                    id: 'comment2',
                    subreddit: 'wallstreetbets',
                    body: 'To the moon!',
                    author: 'commenter2',
                    ups: 100,
                    created_utc: 1234567910,
                  },
                },
              ],
            },
          },
        ],
      });

      const comments = await client.getPostComments('wallstreetbets', 'post123');

      expect(comments).toHaveLength(2);
      expect(comments[0]).toEqual({
        id: 'comment1',
        postId: 'post123',
        subreddit: 'wallstreetbets',
        body: 'HODL!',
        author: 'commenter1',
        upvotes: 50,
        createdAt: 1234567900,
      });
    });

    it('should throw when comments request returns non-ok response', async () => {
      // Mock OAuth success
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      // Mock non-ok comments response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.getPostComments('wallstreetbets', 'post123')).rejects.toThrow(
        'Failed to fetch comments for post post123: Not Found'
      );
    });

    it('should filter out invalid comments (no body)', async () => {
      // Mock OAuth
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      // Mock response with invalid comments
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { data: { children: [] } },
          {
            data: {
              children: [
                {
                  data: {
                    id: 'comment1',
                    subreddit: 'wallstreetbets',
                    body: 'Valid comment',
                    author: 'user1',
                    ups: 10,
                    created_utc: 1234567890,
                  },
                },
                {
                  data: {
                    id: 'more',
                    // No body - this is a "more" object, should be filtered
                  },
                },
              ],
            },
          },
        ],
      });

      const comments = await client.getPostComments('wallstreetbets', 'post123');
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Valid comment');
    });
  });

  describe('scanSubreddits', () => {
    it('should scan multiple subreddits and aggregate results', async () => {
      // Mock OAuth
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      // Mock posts from r/wallstreetbets
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  id: 'post1',
                  subreddit: 'wallstreetbets',
                  title: 'Test post',
                  selftext: 'Body',
                  author: 'user1',
                  ups: 100,
                  created_utc: 1234567890,
                  permalink: '/r/wallstreetbets/comments/post1',
                },
              },
            ],
          },
        }),
      });

      // Mock comments for post1
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { data: { children: [] } },
          {
            data: {
              children: [
                {
                  data: {
                    id: 'comment1',
                    subreddit: 'wallstreetbets',
                    body: 'Great!',
                    author: 'commenter',
                    ups: 10,
                    created_utc: 1234567900,
                  },
                },
              ],
            },
          },
        ],
      });

      const result = await client.scanSubreddits(['wallstreetbets'], 1);

      expect(result.posts).toHaveLength(1);
      expect(result.comments).toHaveLength(1);
      expect(result.posts[0].id).toBe('post1');
      expect(result.comments[0].id).toBe('comment1');
    }, 10000); // Increase timeout due to rate limiting delays

    it('should continue scanning remaining subreddits when one fails', async () => {
      // Mock OAuth (shared token for all calls)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      // First subreddit (wallstreetbets) - fails with non-ok response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      // Second subreddit (stocks) - succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  id: 'post_stocks_1',
                  subreddit: 'stocks',
                  title: 'AAPL analysis',
                  selftext: 'Looking good',
                  author: 'analyst1',
                  ups: 200,
                  created_utc: 1234567890,
                  permalink: '/r/stocks/comments/post_stocks_1',
                },
              },
            ],
          },
        }),
      });

      // Comments for the stocks post
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { data: { children: [] } },
          {
            data: {
              children: [
                {
                  data: {
                    id: 'stocks_comment1',
                    subreddit: 'stocks',
                    body: 'Great analysis!',
                    author: 'reader1',
                    ups: 15,
                    created_utc: 1234567950,
                  },
                },
              ],
            },
          },
        ],
      });

      const result = await client.scanSubreddits(['wallstreetbets', 'stocks'], 1);

      // Should have posts and comments only from the successful subreddit
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].subreddit).toBe('stocks');
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].subreddit).toBe('stocks');
    }, 10000);
  });
});

describe('getRedditClient', () => {
  beforeEach(() => {
    process.env.REDDIT_CLIENT_ID = 'test_client_id';
    process.env.REDDIT_CLIENT_SECRET = 'test_client_secret';
    process.env.REDDIT_USER_AGENT = 'TestAgent/1.0';
    // Reset module state so the singleton is recreated per test
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    delete process.env.REDDIT_USER_AGENT;
  });

  it('should return a RedditClient instance', async () => {
    const { getRedditClient: getClient, RedditClient: Client } = await import('@/lib/reddit');
    const instance = getClient();
    expect(instance).toBeInstanceOf(Client);
  });

  it('should return the same instance on subsequent calls (singleton)', async () => {
    const { getRedditClient: getClient } = await import('@/lib/reddit');
    const first = getClient();
    const second = getClient();
    expect(second).toBe(first);
  });
});
