import type { TrendingStock } from '@/lib/db/storage';
import type { StoredEnrichment } from '@/lib/db/enrichment';
import { normalizeCreatorScore } from '@/lib/creators';

export type SignalLevel = 'hot' | 'rising' | 'watch' | 'none';

export interface OpportunityScore {
  ticker: string;
  score: number; // 0–100
  signalLevel: SignalLevel;
  subScores: {
    velocity: number;        // 0–100, weight 0.25
    sentiment: number;       // 0–100, weight 0.15
    socialDominance: number; // 0–100, weight 0.20
    volumeChange: number;    // 0–100, weight 0.25
    creatorInfluence: number;// 0–100, weight 0.15
  };
}

// velocity: % change, clamp to [0, 500] and normalize to [0, 100]
function normalizeVelocity(velocity: number): number {
  if (velocity <= 0) return 0;
  return Math.min(velocity / 5, 100);
}

// sentimentScore: -1 to 1 → 0 to 100
function normalizeSentiment(sentimentScore: number): number {
  return Math.round(((sentimentScore + 1) / 2) * 100);
}

// social_dominance: 0–100% → 0–100 (5× multiplier, capped at 100)
function normalizeSocialDominance(dominance: number): number {
  return Math.min(dominance * 5, 100);
}

// percent_change_24h: positive price movement → 0–100 (5× multiplier, capped at 100)
function normalizeVolumeChange(pctChange: number): number {
  if (pctChange <= 0) return 0;
  return Math.min(pctChange * 5, 100);
}

function normalizeCreatorInfluence(creators: StoredEnrichment['top_creators']): number {
  return normalizeCreatorScore(creators || []);
}

export function classifySignalLevel(score: number): SignalLevel {
  if (score >= 75) return 'hot';
  if (score >= 50) return 'rising';
  if (score >= 30) return 'watch';
  return 'none';
}

export function computeOpportunityScore(
  stock: TrendingStock,
  enrichment: StoredEnrichment | null
): OpportunityScore {
  const velocityScore = normalizeVelocity(stock.velocity);
  const sentimentScore = normalizeSentiment(stock.sentimentScore);
  const socialDominanceScore = enrichment ? normalizeSocialDominance(enrichment.social_dominance) : 0;
  const volumeChangeScore = enrichment ? normalizeVolumeChange(enrichment.percent_change_24h) : 0;
  const creatorInfluenceScore = enrichment ? normalizeCreatorInfluence(enrichment.top_creators) : 0;

  const score = Math.round(
    velocityScore * 0.25 +
    sentimentScore * 0.15 +
    socialDominanceScore * 0.20 +
    volumeChangeScore * 0.25 +
    creatorInfluenceScore * 0.15
  );

  return {
    ticker: stock.ticker,
    score,
    signalLevel: classifySignalLevel(score),
    subScores: {
      velocity: velocityScore,
      sentiment: sentimentScore,
      socialDominance: socialDominanceScore,
      volumeChange: volumeChangeScore,
      creatorInfluence: creatorInfluenceScore,
    },
  };
}
