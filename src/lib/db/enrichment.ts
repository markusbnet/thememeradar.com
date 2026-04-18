/**
 * DynamoDB storage for LunarCrush enrichment data.
 * Table: stock_enrichment — PK: ticker, SK: timestamp (15-min buckets)
 * TTL: 30 days
 */

import { docClient, TABLES, PutCommand, QueryCommand } from './client';
import type { LunarCrushTopicDetail, LunarCrushCreator } from '@/types/lunarcrush';
import { roundToInterval } from './storage';

export interface StoredEnrichment {
  ticker: string;
  timestamp: number;
  price: number;
  volume_24h: number;
  percent_change_24h: number;
  social_dominance: number;
  galaxy_score: number;
  sentiment: number;
  engagements: number;
  mentions_cross_platform: number;
  top_creators: LunarCrushCreator[];
  engagements_by_network: Record<string, number>;
  fetchedAt: number;
  ttl: number;
}

function getTTL(): number {
  return Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
}

export async function saveEnrichment(
  ticker: string,
  detail: LunarCrushTopicDetail
): Promise<void> {
  const timestamp = roundToInterval(Date.now());
  const item: StoredEnrichment = {
    ticker,
    timestamp,
    price: detail.price,
    volume_24h: detail.volume_24h,
    percent_change_24h: detail.percent_change_24h,
    social_dominance: detail.social_dominance,
    galaxy_score: detail.galaxy_score,
    sentiment: detail.sentiment,
    engagements: detail.interactions,
    mentions_cross_platform: detail.posts_active,
    top_creators: (detail.top_creators || []).slice(0, 5),
    engagements_by_network: detail.engagements_by_network || {},
    fetchedAt: Date.now(),
    ttl: getTTL(),
  };

  await docClient.send(
    new PutCommand({ TableName: TABLES.STOCK_ENRICHMENT, Item: item })
  );
}

export async function getLatestEnrichment(ticker: string): Promise<StoredEnrichment | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STOCK_ENRICHMENT,
      KeyConditionExpression: 'ticker = :ticker',
      ExpressionAttributeValues: { ':ticker': ticker },
      ScanIndexForward: false, // newest first
      Limit: 1,
    })
  );

  return (result.Items?.[0] as StoredEnrichment) || null;
}

export async function getEnrichmentMap(
  tickers: string[]
): Promise<Map<string, StoredEnrichment>> {
  const map = new Map<string, StoredEnrichment>();
  await Promise.all(
    tickers.map(async (ticker) => {
      const enrichment = await getLatestEnrichment(ticker);
      if (enrichment) map.set(ticker, enrichment);
    })
  );
  return map;
}
