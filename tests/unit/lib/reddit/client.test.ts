import { createRedditClient, RedditClient, RedditPost, RedditComment } from '@/lib/reddit/client';

// Mock fetch globally
global.fetch = jest.fn();

describe('Reddit Client', () => {
  let client: RedditClient;
  const mockConfig = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    userAgent: 'test_user_agent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = createRedditClient(mockConfig);
  });

  describe('Authentication', () => {
    it('should authenticate with Reddit OAuth 2.0', async () => {
      const mockToken = {
        access_token: 'mock_access_token',
        token_type: 'bearer',
        expires_in: 3600,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken,
      });

      await client.authenticate();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.reddit.com/api/v1/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'test_user_agent',
          }),
          body: 'grant_type=client_credentials',
        })
      );
    });

    it('should handle authentication failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.authenticate()).rejects.toThrow('Reddit authentication failed');
    });

    it('should auto-refresh token after expiration', async () => {
      const mockToken = {
        access_token: 'mock_access_token',
        token_type: 'bearer',
        expires_in: 1, // Expires in 1 second
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,  // Re-auth returns token
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { children: [] } }),  // API call returns data
        });

      await client.authenticate();

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // This should trigger re-authentication
      await client.getHotPosts('wallstreetbets');

      // Should have called fetch 3 times: initial auth, re-auth, API call
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('getHotPosts', () => {
    beforeEach(async () => {
      // Mock authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock_access_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });
      await client.authenticate();
    });

    it('should fetch hot posts from a subreddit', async () => {
      const mockRedditResponse = {
        data: {
          children: [
            {
              data: {
                id: 'post1',
                subreddit: 'wallstreetbets',
                title: 'GME to the moon 🚀',
                selftext: 'YOLO on GME calls',
                author: 'test_user',
                ups: 1000,
                created_utc: 1234567890,
                permalink: '/r/wallstreetbets/comments/post1/gme_to_the_moon/',
              },
            },
            {
              data: {
                id: 'post2',
                subreddit: 'wallstreetbets',
                title: 'AMC analysis',
                selftext: 'DD on AMC',
                author: 'another_user',
                ups: 500,
                created_utc: 1234567891,
                permalink: '/r/wallstreetbets/comments/post2/amc_analysis/',
              },
            },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      const posts = await client.getHotPosts('wallstreetbets');

      expect(posts).toHaveLength(2);
      expect(posts[0]).toEqual({
        id: 'post1',
        subreddit: 'wallstreetbets',
        title: 'GME to the moon 🚀',
        body: 'YOLO on GME calls',
        author: 'test_user',
        upvotes: 1000,
        createdAt: 1234567890,
        url: 'https://reddit.com/r/wallstreetbets/comments/post1/gme_to_the_moon/',
      });
    });

    it('should respect limit parameter', async () => {
      const mockRedditResponse = {
        data: {
          children: Array(10).fill(null).map((_, i) => ({
            data: {
              id: `post${i}`,
              subreddit: 'wallstreetbets',
              title: `Post ${i}`,
              selftext: `Body ${i}`,
              author: 'user',
              ups: 100,
              created_utc: 1234567890,
              permalink: `/r/wallstreetbets/comments/post${i}/`,
            },
          })),
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      const posts = await client.getHotPosts('wallstreetbets', 10);

      expect(posts).toHaveLength(10);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    it('should default to limit of 25', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { children: [] } }),
      });

      await client.getHotPosts('wallstreetbets');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=25'),
        expect.any(Object)
      );
    });

    it('should handle empty results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { children: [] } }),
      });

      const posts = await client.getHotPosts('wallstreetbets');

      expect(posts).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getHotPosts('wallstreetbets')).rejects.toThrow();
    });

    it('should handle posts with no body text', async () => {
      const mockRedditResponse = {
        data: {
          children: [
            {
              data: {
                id: 'post1',
                subreddit: 'wallstreetbets',
                title: 'Link post',
                selftext: '',
                author: 'user',
                ups: 100,
                created_utc: 1234567890,
                permalink: '/r/wallstreetbets/comments/post1/',
              },
            },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      const posts = await client.getHotPosts('wallstreetbets');

      expect(posts[0].body).toBe('');
    });

    it('should handle deleted/removed posts', async () => {
      const mockRedditResponse = {
        data: {
          children: [
            {
              data: {
                id: 'post1',
                subreddit: 'wallstreetbets',
                title: '[deleted]',
                selftext: '[removed]',
                author: '[deleted]',
                ups: 0,
                created_utc: 1234567890,
                permalink: '/r/wallstreetbets/comments/post1/',
              },
            },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      const posts = await client.getHotPosts('wallstreetbets');

      // Should still return the post (we'll filter deleted posts in the scanner)
      expect(posts).toHaveLength(1);
      expect(posts[0].author).toBe('[deleted]');
    });
  });

  describe('getComments', () => {
    beforeEach(async () => {
      // Mock authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock_access_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });
      await client.authenticate();
    });

    it('should fetch comments for a post', async () => {
      const mockRedditResponse = [
        { data: { children: [] } }, // Post data (we ignore this)
        {
          data: {
            children: [
              {
                data: {
                  id: 'comment1',
                  link_id: 't3_post1',
                  subreddit: 'wallstreetbets',
                  body: 'GME to the moon 🚀',
                  author: 'user1',
                  ups: 50,
                  created_utc: 1234567890,
                },
              },
              {
                data: {
                  id: 'comment2',
                  link_id: 't3_post1',
                  subreddit: 'wallstreetbets',
                  body: 'HODL 💎🙌',
                  author: 'user2',
                  ups: 30,
                  created_utc: 1234567891,
                },
              },
            ],
          },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      const comments = await client.getComments('post1');

      expect(comments).toHaveLength(2);
      expect(comments[0]).toEqual({
        id: 'comment1',
        postId: 'post1',
        subreddit: 'wallstreetbets',
        body: 'GME to the moon 🚀',
        author: 'user1',
        upvotes: 50,
        createdAt: 1234567890,
      });
    });

    it('should handle nested comments (replies)', async () => {
      const mockRedditResponse = [
        { data: { children: [] } },
        {
          data: {
            children: [
              {
                data: {
                  id: 'comment1',
                  link_id: 't3_post1',
                  subreddit: 'wallstreetbets',
                  body: 'Parent comment',
                  author: 'user1',
                  ups: 50,
                  created_utc: 1234567890,
                  replies: {
                    data: {
                      children: [
                        {
                          data: {
                            id: 'comment2',
                            link_id: 't3_post1',
                            subreddit: 'wallstreetbets',
                            body: 'Reply comment',
                            author: 'user2',
                            ups: 10,
                            created_utc: 1234567891,
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      const comments = await client.getComments('post1');

      // Should flatten nested comments
      expect(comments).toHaveLength(2);
      expect(comments[1].body).toBe('Reply comment');
    });

    it('should handle empty comments', async () => {
      const mockRedditResponse = [
        { data: { children: [] } },
        { data: { children: [] } },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      const comments = await client.getComments('post1');

      expect(comments).toEqual([]);
    });

    it('should handle deleted/removed comments', async () => {
      const mockRedditResponse = [
        { data: { children: [] } },
        {
          data: {
            children: [
              {
                data: {
                  id: 'comment1',
                  link_id: 't3_post1',
                  subreddit: 'wallstreetbets',
                  body: '[deleted]',
                  author: '[deleted]',
                  ups: 0,
                  created_utc: 1234567890,
                },
              },
            ],
          },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      const comments = await client.getComments('post1');

      // Should still return deleted comments (we'll filter in scanner)
      expect(comments).toHaveLength(1);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.getComments('post1')).rejects.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      // Mock authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock_access_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });
      await client.authenticate();
    });

    it('should track rate limit (100 requests per minute)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { children: [] } }),
      });

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await client.getHotPosts('wallstreetbets');
      }

      const remaining = client.getRemainingRequests();

      expect(remaining).toBeLessThanOrEqual(95); // 100 - 5 requests
    });

    it('should indicate when rate limited', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { children: [] } }),
      });

      // Initially not rate limited
      expect(client.isRateLimited()).toBe(false);

      // After many requests within 1 minute, should be rate limited
      for (let i = 0; i < 100; i++) {
        await client.getHotPosts('wallstreetbets');
      }

      expect(client.isRateLimited()).toBe(true);
    });

    it('should reset rate limit after 1 minute', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { children: [] } }),
      });

      // Max out rate limit
      for (let i = 0; i < 100; i++) {
        await client.getHotPosts('wallstreetbets');
      }

      expect(client.isRateLimited()).toBe(true);

      // Fast-forward time by 61 seconds
      jest.advanceTimersByTime(61000);

      expect(client.isRateLimited()).toBe(false);
      expect(client.getRemainingRequests()).toBe(100);

      jest.useRealTimers();
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      // Mock authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock_access_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });
      await client.authenticate();
    });

    it('should cache responses for 5 minutes', async () => {
      const mockRedditResponse = {
        data: {
          children: [
            {
              data: {
                id: 'post1',
                subreddit: 'wallstreetbets',
                title: 'Test',
                selftext: 'Body',
                author: 'user',
                ups: 100,
                created_utc: 1234567890,
                permalink: '/r/wallstreetbets/comments/post1/',
              },
            },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRedditResponse,
      });

      // First call - should fetch from API
      const posts1 = await client.getHotPosts('wallstreetbets');

      // Second call - should return cached result (no additional fetch)
      const posts2 = await client.getHotPosts('wallstreetbets');

      expect(posts1).toEqual(posts2);
      expect(global.fetch).toHaveBeenCalledTimes(2); // 1 auth (from beforeEach) + 1 API call
    });

    it('should expire cache after 5 minutes', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { children: [] } }),
      });

      // First call
      await client.getHotPosts('wallstreetbets');

      // Fast-forward 6 minutes
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Second call - should fetch fresh data (cache expired)
      await client.getHotPosts('wallstreetbets');

      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 auth (beforeEach) + 2 API calls

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Mock authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'mock_access_token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });
      await client.authenticate();
    });

    it('should retry on network errors', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { children: [] } }),
        });

      const posts = await client.getHotPosts('wallstreetbets');

      expect(posts).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 auth + 1 failed attempt + 1 retry
    });

    it('should retry on 5xx server errors', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { children: [] } }),
        });

      const posts = await client.getHotPosts('wallstreetbets');

      expect(posts).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 auth + 1 failed attempt + 1 retry
    });

    it('should not retry on 4xx client errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(client.getHotPosts('wallstreetbets')).rejects.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(2); // 1 auth + 1 failed API call (no retry)
    });

    it('should handle rate limit (429) responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name: string) => (name === 'Retry-After' ? '60' : null),
        },
      });

      await expect(client.getHotPosts('wallstreetbets')).rejects.toThrow('Rate limited by Reddit API');
    });
  });
});
