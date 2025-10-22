/**
 * Reddit Scanner Service
 * Orchestrates Reddit data collection, ticker extraction, and sentiment analysis
 */

import { createRedditClient, RedditClient, RedditPost, RedditComment } from '@/lib/reddit/client';
import { detectTickers } from '@/lib/stock/ticker-detector';
import { analyzeSentiment, SentimentResult } from '@/lib/sentiment/analyzer';

// Types
export interface ScannerConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

export interface ScannedPost {
  id: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  upvotes: number;
  createdAt: number;
  url: string;
  tickers: string[];
  comments: ScannedComment[];
}

export interface ScannedComment {
  id: string;
  postId: string;
  body: string;
  author: string;
  upvotes: number;
  createdAt: number;
  tickers: string[];
}

export interface TickerMention {
  ticker: string;
  source: 'post' | 'comment';
  sourceId: string;
  text: string;
  sentiment: SentimentResult;
  upvotes: number;
  subreddit: string;
}

export interface ScanStats {
  totalPosts: number;
  totalComments: number;
  uniqueTickers: number;
  totalMentions: number;
  subredditBreakdown: Record<string, number>;
}

export interface ScanResult {
  scannedAt: number;
  subreddit: string;
  posts: ScannedPost[];
  tickers: Map<string, TickerMention[]>;
  stats: ScanStats;
  error?: string;
}

/**
 * Scanner class that orchestrates the scanning process
 */
export class Scanner {
  private redditClient: RedditClient;
  private authenticated: boolean = false;

  constructor(config: ScannerConfig) {
    this.redditClient = createRedditClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      userAgent: config.userAgent,
    });
  }

  /**
   * Ensure Reddit client is authenticated
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authenticated) {
      await this.redditClient.authenticate();
      this.authenticated = true;
    }
  }

  /**
   * Scan a single subreddit for stock mentions
   */
  async scanSubreddit(subreddit: string, limit: number = 25): Promise<ScanResult> {
    await this.ensureAuthenticated();

    const scannedAt = Date.now();
    const tickerMap = new Map<string, TickerMention[]>();
    const posts: ScannedPost[] = [];

    let totalComments = 0;
    let totalMentions = 0;

    // Fetch hot posts from subreddit
    const redditPosts = await this.redditClient.getHotPosts(subreddit, limit);

    // Process each post
    for (const post of redditPosts) {
      // Extract tickers from post
      const postText = `${post.title} ${post.body}`;
      const postTickers = detectTickers(postText);

      // Fetch comments for this post
      let comments: RedditComment[] = [];
      try {
        comments = await this.redditClient.getComments(post.id);
      } catch (error: any) {
        console.error(`Failed to fetch comments for post ${post.id}:`, error.message);
        // Continue with empty comments
      }

      totalComments += comments.length;

      // Process comments
      const scannedComments: ScannedComment[] = [];
      for (const comment of comments) {
        const commentTickers = detectTickers(comment.body);

        scannedComments.push({
          id: comment.id,
          postId: comment.postId,
          body: comment.body,
          author: comment.author,
          upvotes: comment.upvotes,
          createdAt: comment.createdAt,
          tickers: commentTickers,
        });

        // Add ticker mentions from comment
        for (const ticker of commentTickers) {
          const sentiment = analyzeSentiment(comment.body, ticker);

          const mention: TickerMention = {
            ticker,
            source: 'comment',
            sourceId: comment.id,
            text: comment.body,
            sentiment,
            upvotes: comment.upvotes,
            subreddit,
          };

          if (!tickerMap.has(ticker)) {
            tickerMap.set(ticker, []);
          }
          tickerMap.get(ticker)!.push(mention);
          totalMentions++;
        }
      }

      // Add scanned post
      posts.push({
        id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        body: post.body,
        author: post.author,
        upvotes: post.upvotes,
        createdAt: post.createdAt,
        url: post.url,
        tickers: postTickers,
        comments: scannedComments,
      });

      // Add ticker mentions from post
      for (const ticker of postTickers) {
        const sentiment = analyzeSentiment(postText, ticker);

        const mention: TickerMention = {
          ticker,
          source: 'post',
          sourceId: post.id,
          text: postText,
          sentiment,
          upvotes: post.upvotes,
          subreddit,
        };

        if (!tickerMap.has(ticker)) {
          tickerMap.set(ticker, []);
        }
        tickerMap.get(ticker)!.push(mention);
        totalMentions++;
      }
    }

    // Calculate statistics
    const stats: ScanStats = {
      totalPosts: posts.length,
      totalComments,
      uniqueTickers: tickerMap.size,
      totalMentions,
      subredditBreakdown: {
        [subreddit]: totalMentions,
      },
    };

    return {
      scannedAt,
      subreddit,
      posts,
      tickers: tickerMap,
      stats,
    };
  }

  /**
   * Scan multiple subreddits sequentially
   * Processes one at a time to respect rate limits
   */
  async scanMultipleSubreddits(
    subreddits: string[],
    limit: number = 25
  ): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    for (const subreddit of subreddits) {
      try {
        const result = await this.scanSubreddit(subreddit, limit);
        results.push(result);
      } catch (error: any) {
        // Add error result for failed subreddit
        results.push({
          scannedAt: Date.now(),
          subreddit,
          posts: [],
          tickers: new Map(),
          stats: {
            totalPosts: 0,
            totalComments: 0,
            uniqueTickers: 0,
            totalMentions: 0,
            subredditBreakdown: {},
          },
          error: error.message,
        });
      }
    }

    return results;
  }
}

/**
 * Factory function to create a Scanner instance
 */
export function createScanner(config: ScannerConfig): Scanner {
  return new Scanner(config);
}
