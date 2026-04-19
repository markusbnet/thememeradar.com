import { logger } from '@/lib/logger';
/**
 * Reddit Scanner Service
 * Orchestrates Reddit data collection, ticker extraction, and sentiment analysis
 */

import { RedditClient, type RedditPost, type RedditComment } from '@/lib/reddit';
import { extractTickers } from '@/lib/ticker-detection';
import { analyzeSentiment, type SentimentResult } from '@/lib/sentiment';
import { RedditCallBudget } from '@/lib/rate-limit';
import { LISTING_MIX, REDDIT_CALL_BUDGET } from './config';

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
  /** Listing-type weight: hot=1.0, new=0.5, rising=1.5 */
  listingWeight: number;
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

  constructor(config: ScannerConfig) {
    // Set env vars for RedditClient (it reads from process.env)
    process.env.REDDIT_CLIENT_ID = config.clientId;
    process.env.REDDIT_CLIENT_SECRET = config.clientSecret;
    process.env.REDDIT_USER_AGENT = config.userAgent;

    this.redditClient = new RedditClient();
  }

  /**
   * Scan a single subreddit for stock mentions.
   * Fetches hot + /new + /rising listings, deduplicates by postId, and
   * applies listing-type weights to ticker mentions.
   */
  async scanSubreddit(subreddit: string, limit: number = 25): Promise<ScanResult> {
    const scannedAt = Date.now();
    const tickerMap = new Map<string, TickerMention[]>();
    const posts: ScannedPost[] = [];
    const budget = new RedditCallBudget(REDDIT_CALL_BUDGET);

    let totalComments = 0;
    let totalMentions = 0;

    // Build per-listing post lists, deduplicated across listings by postId
    const seenPostIds = new Set<string>();
    const postListings: Array<{ post: RedditPost; weight: number; commentThreshold: number }> = [];

    const addListingPosts = (redditPosts: RedditPost[], weight: number, commentThreshold: number) => {
      for (const post of redditPosts) {
        if (!seenPostIds.has(post.id)) {
          seenPostIds.add(post.id);
          postListings.push({ post, weight, commentThreshold });
        }
      }
    };

    // Hot: all subreddits, weight 1.0
    if (budget.canMakeCall()) {
      const hotConfig = LISTING_MIX.hot;
      const hotPosts = await this.redditClient.getHotPosts(subreddit, limit);
      budget.recordCall();
      addListingPosts(hotPosts, hotConfig.weight, hotConfig.commentThreshold);
    }

    // /new: only for configured subreddits, weight 0.5
    const newConfig = LISTING_MIX.new;
    const newSubreddits = newConfig.subreddits as string[];
    if (budget.canMakeCall() && newSubreddits.includes(subreddit)) {
      const newPosts = await this.redditClient.getNewPosts(subreddit, newConfig.limit);
      budget.recordCall();
      addListingPosts(newPosts, newConfig.weight, newConfig.commentThreshold);
    }

    // /rising: only for configured subreddits (WSB), weight 1.5
    const risingConfig = LISTING_MIX.rising;
    const risingSubreddits = risingConfig.subreddits as string[];
    if (budget.canMakeCall() && risingSubreddits.includes(subreddit)) {
      const risingPosts = await this.redditClient.getRisingPosts(subreddit, risingConfig.limit);
      budget.recordCall();
      addListingPosts(risingPosts, risingConfig.weight, risingConfig.commentThreshold);
    }

    if (budget.callsUsed >= REDDIT_CALL_BUDGET * 0.9) {
      logger.warn(`[Scanner] Budget near limit: ${budget.callsUsed}/${REDDIT_CALL_BUDGET} calls used for r/${subreddit}`);
    }

    // Process each deduplicated post
    for (const { post, weight, commentThreshold } of postListings) {
      const postText = `${post.title} ${post.body}`;
      const postTickers = extractTickers(postText);

      // Fetch comments if post meets upvote threshold for its listing type
      let comments: RedditComment[] = [];
      if (post.upvotes >= commentThreshold && budget.canMakeCall()) {
        try {
          comments = await this.redditClient.getPostComments(subreddit, post.id);
          budget.recordCall();
        } catch (error: unknown) {
          logger.error(`Failed to fetch comments for post ${post.id}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }

      totalComments += comments.length;

      const scannedComments: ScannedComment[] = [];
      for (const comment of comments) {
        const commentTickers = extractTickers(comment.body);

        scannedComments.push({
          id: comment.id,
          postId: comment.postId,
          body: comment.body,
          author: comment.author,
          upvotes: comment.upvotes,
          createdAt: comment.createdAt,
          tickers: commentTickers,
        });

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
            listingWeight: weight,
          };
          if (!tickerMap.has(ticker)) tickerMap.set(ticker, []);
          tickerMap.get(ticker)!.push(mention);
          totalMentions++;
        }
      }

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
          listingWeight: weight,
        };
        if (!tickerMap.has(ticker)) tickerMap.set(ticker, []);
        tickerMap.get(ticker)!.push(mention);
        totalMentions++;
      }
    }

    logger.info(`[Scanner] r/${subreddit}: ${posts.length} posts, ${totalComments} comments, ${tickerMap.size} tickers, ${budget.callsUsed} API calls`);

    return {
      scannedAt,
      subreddit,
      posts,
      tickers: tickerMap,
      stats: {
        totalPosts: posts.length,
        totalComments,
        uniqueTickers: tickerMap.size,
        totalMentions,
        subredditBreakdown: { [subreddit]: totalMentions },
      },
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
      } catch (error: unknown) {
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
          error: error instanceof Error ? error.message : 'Unknown error',
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
