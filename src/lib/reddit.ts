import { logger } from './logger';
/**
 * Reddit API Client
 * Handles OAuth authentication and fetching posts/comments from subreddits
 */

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  upvotes: number;
  createdAt: number;
  url: string;
}

interface RedditComment {
  id: string;
  postId: string;
  subreddit: string;
  body: string;
  author: string;
  upvotes: number;
  createdAt: number;
}

interface RedditOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RedditListingResponse {
  data: {
    children: Array<{
      data: {
        id: string;
        subreddit: string;
        title?: string;
        selftext?: string;
        body?: string;
        author: string;
        ups: number;
        created_utc: number;
        permalink: string;
        link_id?: string;
      };
    }>;
  };
}

export class RedditClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly userAgent: string;

  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    this.userAgent = process.env.REDDIT_USER_AGENT || 'MemeRadar/1.0';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Reddit API credentials not configured');
    }
  }

  /**
   * Authenticate with Reddit OAuth
   */
  private async authenticate(): Promise<void> {
    const now = Date.now();

    // Token still valid, no need to re-authenticate
    if (this.accessToken && now < this.tokenExpiry) {
      logger.info('[Reddit] Using cached access token');
      return;
    }

    logger.info('[Reddit] Authenticating with Reddit OAuth...');
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[Reddit] OAuth failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Reddit OAuth failed: ${response.statusText}`);
    }

    const data: RedditOAuthResponse = await response.json();
    this.accessToken = data.access_token;
    // Set expiry to 5 minutes before actual expiry (buffer)
    this.tokenExpiry = now + (data.expires_in - 300) * 1000;
    logger.info(`[Reddit] Successfully authenticated. Token expires in ${data.expires_in}s`);
  }

  /**
   * Fetch hot posts from a subreddit
   */
  async getHotPosts(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
    await this.authenticate();

    logger.info(`[Reddit] Fetching ${limit} hot posts from r/${subreddit}`);
    const url = `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      logger.error(`[Reddit] Failed to fetch posts from r/${subreddit}: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch posts from r/${subreddit}: ${response.statusText}`);
    }

    const listing: RedditListingResponse = await response.json();
    const postCount = listing.data.children.length;
    logger.info(`[Reddit] Received ${postCount} posts from r/${subreddit}`);

    return listing.data.children.map(child => ({
      id: child.data.id,
      subreddit: child.data.subreddit,
      title: child.data.title || '',
      body: child.data.selftext || '',
      author: child.data.author,
      upvotes: child.data.ups,
      createdAt: child.data.created_utc,
      url: `https://reddit.com${child.data.permalink}`,
    }));
  }

  /**
   * Fetch newest posts from a subreddit (/new listing)
   */
  async getNewPosts(subreddit: string, limit: number = 30): Promise<RedditPost[]> {
    return this.fetchListing(subreddit, 'new', limit);
  }

  /**
   * Fetch rising posts from a subreddit (/rising listing)
   */
  async getRisingPosts(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
    return this.fetchListing(subreddit, 'rising', limit);
  }

  private async fetchListing(subreddit: string, listing: string, limit: number): Promise<RedditPost[]> {
    await this.authenticate();

    logger.info(`[Reddit] Fetching ${limit} ${listing} posts from r/${subreddit}`);
    const url = `https://oauth.reddit.com/r/${subreddit}/${listing}?limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      logger.error(`[Reddit] Failed to fetch ${listing} posts from r/${subreddit}: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch ${listing} posts from r/${subreddit}: ${response.statusText}`);
    }

    const data: RedditListingResponse = await response.json();
    logger.info(`[Reddit] Received ${data.data.children.length} ${listing} posts from r/${subreddit}`);

    return data.data.children.map(child => ({
      id: child.data.id,
      subreddit: child.data.subreddit,
      title: child.data.title || '',
      body: child.data.selftext || '',
      author: child.data.author,
      upvotes: child.data.ups,
      createdAt: child.data.created_utc,
      url: `https://reddit.com${child.data.permalink}`,
    }));
  }

  /**
   * Fetch comments for a specific post
   */
  async getPostComments(subreddit: string, postId: string): Promise<RedditComment[]> {
    await this.authenticate();

    const url = `https://oauth.reddit.com/r/${subreddit}/comments/${postId}?limit=100&depth=1`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch comments for post ${postId}: ${response.statusText}`);
    }

    const [, commentsListing]: [RedditListingResponse, RedditListingResponse] = await response.json();

    const comments: RedditComment[] = [];

    for (const child of commentsListing.data.children) {
      // Skip "more" objects that aren't actual comments
      if (!child.data.body) continue;

      comments.push({
        id: child.data.id,
        postId: postId,
        subreddit: child.data.subreddit,
        body: child.data.body,
        author: child.data.author,
        upvotes: child.data.ups,
        createdAt: child.data.created_utc,
      });
    }

    return comments;
  }

  /**
   * Scan multiple subreddits and fetch all posts with comments
   */
  async scanSubreddits(subreddits: string[], postsPerSubreddit: number = 25): Promise<{
    posts: RedditPost[];
    comments: RedditComment[];
  }> {
    const allPosts: RedditPost[] = [];
    const allComments: RedditComment[] = [];

    for (const subreddit of subreddits) {
      try {
        // Fetch hot posts from subreddit
        const posts = await this.getHotPosts(subreddit, postsPerSubreddit);
        allPosts.push(...posts);

        // Fetch comments for each post
        for (const post of posts) {
          try {
            const comments = await this.getPostComments(subreddit, post.id);
            allComments.push(...comments);

            // Rate limiting: 100 requests/minute max
            // Wait 700ms between requests (safe margin)
            await new Promise(resolve => setTimeout(resolve, 700));
          } catch (error) {
            logger.error(`Failed to fetch comments for post ${post.id}:`, error);
            // Continue with other posts even if one fails
          }
        }
      } catch (error) {
        logger.error(`Failed to scan subreddit r/${subreddit}:`, error);
        // Continue with other subreddits even if one fails
      }
    }

    return { posts: allPosts, comments: allComments };
  }
}

// Export lazy singleton instance
let _redditClient: RedditClient | null = null;

export function getRedditClient(): RedditClient {
  if (!_redditClient) {
    _redditClient = new RedditClient();
  }
  return _redditClient;
}

// Export types
export type { RedditPost, RedditComment };
