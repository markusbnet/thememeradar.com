/**
 * E2E seed helper. Uses the real DynamoDB client so the dashboard sees data
 * that matches what the scanner produces in production. Intentionally
 * different from scripts/seed-db.ts — tests need ticker isolation so parallel
 * tests don't stomp each other.
 */

import { docClient, TABLES, PutCommand } from '../../../src/lib/db/client';

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
const FIFTEEN_MIN = 15 * 60 * 1000;

export async function seedTrendingTicker(
  ticker: string,
  overrides: {
    mentionCount?: number;
    sentimentScore?: number;
    sentimentCategory?: string;
    at?: number;
  } = {}
) {
  const now = overrides.at ?? Date.now();
  const bucket = Math.floor(now / FIFTEEN_MIN) * FIFTEEN_MIN;
  const prev = bucket - FIFTEEN_MIN;
  const mentionCount = overrides.mentionCount ?? 40;
  const score = overrides.sentimentScore ?? 0.5;
  const category = overrides.sentimentCategory ?? 'strong_bullish';

  await docClient.send(
    new PutCommand({
      TableName: TABLES.STOCK_MENTIONS,
      Item: {
        ticker,
        timestamp: bucket,
        mentionCount,
        uniquePosts: Math.ceil(mentionCount / 4),
        uniqueComments: mentionCount - Math.ceil(mentionCount / 4),
        avgSentimentScore: score,
        sentimentScore: score,
        sentimentCategory: category,
        bullishCount: Math.floor(mentionCount * 0.7),
        bearishCount: Math.floor(mentionCount * 0.1),
        neutralCount: Math.floor(mentionCount * 0.2),
        totalUpvotes: mentionCount * 25,
        upvoteScore: mentionCount * 25,
        subredditBreakdown: { wallstreetbets: mentionCount },
        topKeywords: ['moon', 'diamond hands'],
        ttl: Math.floor(now / 1000) + THIRTY_DAYS_SEC,
      },
    })
  );

  // Previous bucket with lower count so velocity is positive; this keeps the
  // ticker on the Trending list instead of the Fading list.
  await docClient.send(
    new PutCommand({
      TableName: TABLES.STOCK_MENTIONS,
      Item: {
        ticker,
        timestamp: prev,
        mentionCount: Math.max(1, Math.floor(mentionCount / 4)),
        uniquePosts: 1,
        uniqueComments: 1,
        avgSentimentScore: score,
        sentimentScore: score,
        sentimentCategory: category,
        bullishCount: 2,
        bearishCount: 0,
        neutralCount: 1,
        totalUpvotes: mentionCount,
        upvoteScore: mentionCount,
        subredditBreakdown: { wallstreetbets: 3 },
        topKeywords: ['moon'],
        ttl: Math.floor(now / 1000) + THIRTY_DAYS_SEC,
      },
    })
  );
}

export async function seedEvidence(ticker: string, count = 2) {
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.STOCK_EVIDENCE,
        Item: {
          ticker,
          evidenceId: `e2e-${ticker}-${i}-${now}`,
          type: i === 0 ? 'post' : 'comment',
          text: `Seeded evidence ${i} for ${ticker}. Moon. Diamond hands.`,
          keywords: ['moon', 'diamond hands'],
          sentimentScore: 0.5,
          sentimentCategory: 'strong_bullish',
          upvotes: 100 + i,
          subreddit: 'wallstreetbets',
          redditUrl: `https://reddit.com/r/wallstreetbets/e2e-${ticker}-${i}`,
          createdAt: now,
          ttl: Math.floor(now / 1000) + THIRTY_DAYS_SEC,
        },
      })
    );
  }
}
