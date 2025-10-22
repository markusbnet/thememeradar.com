/**
 * Reddit API Client
 * Handles OAuth 2.0 authentication, rate limiting, and data fetching from Reddit
 */

// Types
export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  upvotes: number;
  createdAt: number;
  url: string;
}

export interface RedditComment {
  id: string;
  postId: string;
  subreddit: string;
  body: string;
  author: string;
  upvotes: number;
  createdAt: number;
}

export interface RedditConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

interface AccessToken {
  token: string;
  expiresAt: number; // Unix timestamp
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Reddit API Client Class
export class RedditClient {
  private config: RedditConfig;
  private accessToken: AccessToken | null = null;
  private requestTimestamps: number[] = []; // Track last 100 request timestamps
  private cache: Map<string, CacheEntry<any>> = new Map();

  constructor(config: RedditConfig) {
    this.config = config;
  }

  /**
   * Authenticate with Reddit OAuth 2.0
   * Uses client credentials flow for script-based apps
   */
  async authenticate(): Promise<void> {
    const credentials = btoa(`${this.config.clientId}:${this.config.clientSecret}`);

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.config.userAgent,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Reddit authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Calculate expiry with safety buffer (1 min or 50% of token lifetime, whichever is less)
    const expiresInMs = data.expires_in * 1000;
    const safetyBuffer = Math.min(60000, expiresInMs * 0.5);

    this.accessToken = {
      token: data.access_token,
      expiresAt: Date.now() + expiresInMs - safetyBuffer,
    };
  }

  /**
   * Ensure we have a valid access token
   * Auto-refreshes if expired
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.accessToken.expiresAt) {
      await this.authenticate();
    }
  }

  /**
   * Make an authenticated request to Reddit API
   * Handles rate limiting, caching, retries
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    retries = 1
  ): Promise<T> {
    // Track request for rate limiting (even for cache hits)
    this.requestTimestamps.push(Date.now());
    if (this.requestTimestamps.length > 100) {
      this.requestTimestamps.shift();
    }

    // Check cache after tracking
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }

    // Ensure authenticated
    await this.ensureAuthenticated();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${this.accessToken!.token}`,
          'User-Agent': this.config.userAgent,
        },
      });

      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get?.('Retry-After') || 'unknown';
          throw new Error(`Rate limited by Reddit API. Retry after: ${retryAfter}s`);
        }

        // Retry on 5xx errors
        if (response.status >= 500 && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
          return this.makeRequest(url, options, cacheKey, retries - 1);
        }

        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the response
      if (cacheKey) {
        this.cache.set(cacheKey, {
          data,
          expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
        });
      }

      return data;
    } catch (error: any) {
      // Retry on network errors
      if (retries > 0 && (error.message?.includes('Network error') || error.message?.includes('fetch failed'))) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.makeRequest(url, options, cacheKey, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Get hot posts from a subreddit
   */
  async getHotPosts(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
    const cacheKey = `posts:${subreddit}:${limit}`;
    const url = `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}`;

    const response = await this.makeRequest<any>(url, {}, cacheKey);

    if (!response.data || !response.data.children) {
      return [];
    }

    return response.data.children.map((child: any) => {
      const post = child.data;
      return {
        id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        body: post.selftext || '',
        author: post.author,
        upvotes: post.ups,
        createdAt: post.created_utc,
        url: `https://reddit.com${post.permalink}`,
      };
    });
  }

  /**
   * Get comments for a post
   * Recursively flattens nested replies
   */
  async getComments(postId: string): Promise<RedditComment[]> {
    const cacheKey = `comments:${postId}`;
    const url = `https://oauth.reddit.com/comments/${postId}`;

    const response = await this.makeRequest<any[]>(url, {}, cacheKey);

    if (!Array.isArray(response) || response.length < 2) {
      return [];
    }

    // Response[0] is post data, Response[1] is comments
    const commentsListing = response[1];

    if (!commentsListing.data || !commentsListing.data.children) {
      return [];
    }

    // Flatten all comments (including nested replies)
    const flattenComments = (children: any[], postId: string): RedditComment[] => {
      const comments: RedditComment[] = [];

      for (const child of children) {
        // Skip non-comment items (kind should be 't1' for comments, but may be missing in mocks)
        if (child.kind && child.kind !== 't1') continue;

        const comment = child.data;
        if (!comment) continue; // Skip if no data

        // Extract post ID from link_id (format: t3_postid)
        const extractedPostId = comment.link_id?.replace('t3_', '') || postId;

        comments.push({
          id: comment.id,
          postId: extractedPostId,
          subreddit: comment.subreddit,
          body: comment.body || '',
          author: comment.author,
          upvotes: comment.ups,
          createdAt: comment.created_utc,
        });

        // Recursively process replies
        if (comment.replies && typeof comment.replies === 'object') {
          const replyChildren = comment.replies.data?.children || [];
          comments.push(...flattenComments(replyChildren, extractedPostId));
        }
      }

      return comments;
    };

    return flattenComments(commentsListing.data.children, postId);
  }

  /**
   * Check if currently rate limited (100 requests per minute)
   */
  isRateLimited(): boolean {
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    return recentRequests.length >= 100;
  }

  /**
   * Get remaining requests in current minute
   */
  getRemainingRequests(): number {
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    return Math.max(0, 100 - recentRequests.length);
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Factory function to create a Reddit client
 */
export function createRedditClient(config: RedditConfig): RedditClient {
  return new RedditClient(config);
}
