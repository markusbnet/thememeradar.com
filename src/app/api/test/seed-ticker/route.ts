import { NextRequest, NextResponse } from 'next/server';
import { docClient, TABLES, PutCommand } from '@/lib/db/client';

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
const FIFTEEN_MIN = 15 * 60 * 1000;

function guardTestEndpoint() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_ENDPOINTS) {
    return NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const guard = guardTestEndpoint();
  if (guard) return guard;

  const body = await request.json();
  const {
    ticker,
    mentionCount = 40,
    sentimentScore = 0.5,
    sentimentCategory = 'strong_bullish',
    evidenceCount = 2,
  } = body;

  if (!ticker) {
    return NextResponse.json({ success: false, error: 'ticker required' }, { status: 400 });
  }

  const now = Date.now();
  const bucket = Math.floor(now / FIFTEEN_MIN) * FIFTEEN_MIN;
  const prev = bucket - FIFTEEN_MIN;
  const ttl = Math.floor(now / 1000) + THIRTY_DAYS_SEC;

  await docClient.send(new PutCommand({
    TableName: TABLES.STOCK_MENTIONS,
    Item: {
      ticker,
      timestamp: bucket,
      mentionCount,
      uniquePosts: Math.ceil(mentionCount / 4),
      uniqueComments: mentionCount - Math.ceil(mentionCount / 4),
      avgSentimentScore: sentimentScore,
      sentimentScore,
      sentimentCategory,
      bullishCount: Math.floor(mentionCount * 0.7),
      bearishCount: Math.floor(mentionCount * 0.1),
      neutralCount: Math.floor(mentionCount * 0.2),
      totalUpvotes: mentionCount * 25,
      upvoteScore: mentionCount * 25,
      subredditBreakdown: { wallstreetbets: mentionCount },
      topKeywords: ['moon', 'diamond hands'],
      ttl,
    },
  }));

  await docClient.send(new PutCommand({
    TableName: TABLES.STOCK_MENTIONS,
    Item: {
      ticker,
      timestamp: prev,
      mentionCount: Math.max(1, Math.floor(mentionCount / 4)),
      uniquePosts: 1,
      uniqueComments: 1,
      avgSentimentScore: sentimentScore,
      sentimentScore,
      sentimentCategory,
      bullishCount: 2,
      bearishCount: 0,
      neutralCount: 1,
      totalUpvotes: mentionCount,
      upvoteScore: mentionCount,
      subredditBreakdown: { wallstreetbets: 3 },
      topKeywords: ['moon'],
      ttl,
    },
  }));

  for (let i = 0; i < evidenceCount; i++) {
    await docClient.send(new PutCommand({
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
        ttl,
      },
    }));
  }

  return NextResponse.json({ success: true, ticker, bucket, prev });
}
