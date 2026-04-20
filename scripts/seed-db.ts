/**
 * Seeds DynamoDB Local with a minimal, deterministic fixture so a fresh
 * clone has visible dashboard data without waiting on a Reddit scan.
 *
 * Intentionally tiny: three tickers, two evidence items each, spread over
 * the last hour so the "recent mentions" freshness check succeeds. Re-running
 * this script is safe — items use stable keys and will overwrite.
 *
 * Usage:  npm run db:seed
 */

import { docClient, TABLES, PutCommand } from '../src/lib/db/client';

const requiredEnv = [
  'DYNAMODB_ENDPOINT',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `✗ Missing env: ${missing.join(', ')}. Run via: npm run db:seed`
  );
  process.exit(1);
}

const now = Date.now();
const FIVE_MIN = 5 * 60 * 1000;
const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

// Align to a 15-minute bucket so stored mentions match how real scans key
// their rows (keeps getTrendingStocks' bucketing logic happy).
const bucket = Math.floor(now / (15 * 60 * 1000)) * (15 * 60 * 1000);

const TICKERS = [
  {
    ticker: 'GME',
    mentionCount: 42,
    sentimentScore: 0.65,
    sentimentCategory: 'strong_bullish',
    bullish: 30,
    bearish: 5,
    neutral: 7,
    upvotes: 1200,
    keywords: ['moon', 'diamond hands', 'yolo'],
    subs: { wallstreetbets: 30, Superstonk: 12 },
  },
  {
    ticker: 'AMC',
    mentionCount: 28,
    sentimentScore: 0.22,
    sentimentCategory: 'bullish',
    bullish: 15,
    bearish: 6,
    neutral: 7,
    upvotes: 640,
    keywords: ['apes', 'hold'],
    subs: { wallstreetbets: 20, stocks: 8 },
  },
  {
    ticker: 'TSLA',
    mentionCount: 18,
    sentimentScore: -0.35,
    sentimentCategory: 'bearish',
    bullish: 4,
    bearish: 10,
    neutral: 4,
    upvotes: 250,
    keywords: ['puts', 'dump'],
    subs: { wallstreetbets: 12, stocks: 6 },
  },
];

async function seedMentions() {
  for (const t of TICKERS) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.STOCK_MENTIONS,
        Item: {
          ticker: t.ticker,
          timestamp: bucket,
          mentionCount: t.mentionCount,
          uniquePosts: Math.ceil(t.mentionCount / 4),
          uniqueComments: t.mentionCount - Math.ceil(t.mentionCount / 4),
          avgSentimentScore: t.sentimentScore,
          sentimentScore: t.sentimentScore,
          sentimentCategory: t.sentimentCategory,
          bullishCount: t.bullish,
          bearishCount: t.bearish,
          neutralCount: t.neutral,
          totalUpvotes: t.upvotes,
          upvoteScore: t.upvotes,
          subredditBreakdown: t.subs,
          topKeywords: t.keywords,
          ttl: Math.floor(now / 1000) + THIRTY_DAYS_SEC,
        },
      })
    );

    // Previous bucket with lower mention count so velocity is positive and
    // the ticker appears in "trending" rather than "fading" rankings.
    await docClient.send(
      new PutCommand({
        TableName: TABLES.STOCK_MENTIONS,
        Item: {
          ticker: t.ticker,
          timestamp: bucket - FIVE_MIN * 3,
          mentionCount: Math.max(1, Math.floor(t.mentionCount / 3)),
          uniquePosts: 1,
          uniqueComments: 2,
          avgSentimentScore: t.sentimentScore * 0.8,
          sentimentScore: t.sentimentScore * 0.8,
          sentimentCategory: t.sentimentCategory,
          bullishCount: Math.floor(t.bullish / 3),
          bearishCount: Math.floor(t.bearish / 3),
          neutralCount: Math.floor(t.neutral / 3),
          totalUpvotes: Math.floor(t.upvotes / 3),
          upvoteScore: Math.floor(t.upvotes / 3),
          subredditBreakdown: t.subs,
          topKeywords: t.keywords,
          ttl: Math.floor(now / 1000) + THIRTY_DAYS_SEC,
        },
      })
    );
  }
}

async function seedEvidence() {
  for (const t of TICKERS) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.STOCK_EVIDENCE,
        Item: {
          ticker: t.ticker,
          evidenceId: `seed-post-${t.ticker}-1`,
          type: 'post',
          text: `${t.ticker} is looking strong today. ${t.keywords[0]}!`,
          keywords: t.keywords,
          sentimentScore: t.sentimentScore,
          sentimentCategory: t.sentimentCategory,
          upvotes: 420,
          subreddit: 'wallstreetbets',
          redditUrl: `https://reddit.com/r/wallstreetbets/seed-${t.ticker}`,
          createdAt: now,
          ttl: Math.floor(now / 1000) + THIRTY_DAYS_SEC,
        },
      })
    );
    await docClient.send(
      new PutCommand({
        TableName: TABLES.STOCK_EVIDENCE,
        Item: {
          ticker: t.ticker,
          evidenceId: `seed-comment-${t.ticker}-1`,
          type: 'comment',
          text: `Agreed on ${t.ticker}, ${t.keywords[1] || t.keywords[0]}.`,
          keywords: t.keywords,
          sentimentScore: t.sentimentScore,
          sentimentCategory: t.sentimentCategory,
          upvotes: 85,
          subreddit: 'wallstreetbets',
          redditUrl: `https://reddit.com/r/wallstreetbets/seed-${t.ticker}#c1`,
          createdAt: now,
          ttl: Math.floor(now / 1000) + THIRTY_DAYS_SEC,
        },
      })
    );
  }
}

async function main() {
  console.log('=== Seeding DynamoDB with fixture data ===\n');
  await seedMentions();
  console.log(`✓ Seeded ${TICKERS.length} tickers × 2 buckets in stock_mentions`);
  await seedEvidence();
  console.log(`✓ Seeded ${TICKERS.length} tickers × 2 items in stock_evidence`);
  console.log('\nTickers: ' + TICKERS.map((t) => t.ticker).join(', '));
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err?.message || err);
  process.exit(1);
});
