import {
  computeOpportunityScore,
  classifySignalLevel,
  type OpportunityScore,
} from '@/lib/opportunity-score';
import type { TrendingStock } from '@/lib/db/storage';
import type { StoredEnrichment } from '@/lib/db/enrichment';

const baseStock: TrendingStock = {
  ticker: 'GME',
  mentionCount: 100,
  sentimentScore: 0.5,
  sentimentCategory: 'bullish',
  velocity: 100,
  timestamp: 1700000000000,
};

const baseEnrichment: StoredEnrichment = {
  ticker: 'GME',
  timestamp: 1700000000000,
  price: 25.0,
  volume_24h: 1000000,
  percent_change_24h: 10,
  social_dominance: 5,
  galaxy_score: 60,
  sentiment: 4,
  engagements: 50000,
  mentions_cross_platform: 200,
  top_creators: [
    { screen_name: 'user1', network: 'twitter', influencer_rank: 10, followers: 500000, posts: 5, engagements: 10000 },
    { screen_name: 'user2', network: 'twitter', influencer_rank: 50, followers: 200000, posts: 3, engagements: 5000 },
    { screen_name: 'user3', network: 'reddit', influencer_rank: 80, followers: 50000, posts: 2, engagements: 2000 },
  ],
  engagements_by_network: { twitter: 45000, reddit: 5000 },
  fetchedAt: 1700000000000,
  ttl: 1702592000,
};

describe('computeOpportunityScore', () => {
  it('returns score in 0–100 range', () => {
    const result = computeOpportunityScore(baseStock, baseEnrichment);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns all five sub-scores in 0–100 range', () => {
    const result = computeOpportunityScore(baseStock, baseEnrichment);
    const { subScores } = result;
    expect(subScores.velocity).toBeGreaterThanOrEqual(0);
    expect(subScores.velocity).toBeLessThanOrEqual(100);
    expect(subScores.sentiment).toBeGreaterThanOrEqual(0);
    expect(subScores.sentiment).toBeLessThanOrEqual(100);
    expect(subScores.socialDominance).toBeGreaterThanOrEqual(0);
    expect(subScores.socialDominance).toBeLessThanOrEqual(100);
    expect(subScores.volumeChange).toBeGreaterThanOrEqual(0);
    expect(subScores.volumeChange).toBeLessThanOrEqual(100);
    expect(subScores.creatorInfluence).toBeGreaterThanOrEqual(0);
    expect(subScores.creatorInfluence).toBeLessThanOrEqual(100);
  });

  it('velocity=500 clamps to sub-score 100', () => {
    const result = computeOpportunityScore({ ...baseStock, velocity: 500 }, null);
    expect(result.subScores.velocity).toBe(100);
  });

  it('velocity=0 yields sub-score 0', () => {
    const result = computeOpportunityScore({ ...baseStock, velocity: 0 }, null);
    expect(result.subScores.velocity).toBe(0);
  });

  it('negative velocity yields sub-score 0', () => {
    const result = computeOpportunityScore({ ...baseStock, velocity: -50 }, null);
    expect(result.subScores.velocity).toBe(0);
  });

  it('velocity=250 yields sub-score 50', () => {
    const result = computeOpportunityScore({ ...baseStock, velocity: 250 }, null);
    expect(result.subScores.velocity).toBe(50);
  });

  it('sentiment=1 yields sentiment sub-score 100', () => {
    const result = computeOpportunityScore({ ...baseStock, sentimentScore: 1 }, null);
    expect(result.subScores.sentiment).toBe(100);
  });

  it('sentiment=0 yields sentiment sub-score 50', () => {
    const result = computeOpportunityScore({ ...baseStock, sentimentScore: 0 }, null);
    expect(result.subScores.sentiment).toBe(50);
  });

  it('sentiment=-1 yields sentiment sub-score 0', () => {
    const result = computeOpportunityScore({ ...baseStock, sentimentScore: -1 }, null);
    expect(result.subScores.sentiment).toBe(0);
  });

  it('null enrichment sets socialDominance, volumeChange, creatorInfluence to 0', () => {
    const result = computeOpportunityScore(baseStock, null);
    expect(result.subScores.socialDominance).toBe(0);
    expect(result.subScores.volumeChange).toBe(0);
    expect(result.subScores.creatorInfluence).toBe(0);
  });

  it('percent_change_24h=20 clamps volumeChange sub-score to 100', () => {
    const result = computeOpportunityScore(baseStock, { ...baseEnrichment, percent_change_24h: 20 });
    expect(result.subScores.volumeChange).toBe(100);
  });

  it('negative percent_change_24h yields volumeChange sub-score 0', () => {
    const result = computeOpportunityScore(baseStock, { ...baseEnrichment, percent_change_24h: -5 });
    expect(result.subScores.volumeChange).toBe(0);
  });

  it('social_dominance=20 clamps socialDominance sub-score to 100', () => {
    const result = computeOpportunityScore(baseStock, { ...baseEnrichment, social_dominance: 20 });
    expect(result.subScores.socialDominance).toBe(100);
  });

  it('5 creators yields creatorInfluence sub-score 100', () => {
    const creators = Array.from({ length: 5 }, (_, i) => ({
      screen_name: `user${i}`,
      network: 'twitter',
      influencer_rank: i + 1,
      followers: 100000,
      posts: 3,
      engagements: 5000,
    }));
    const result = computeOpportunityScore(baseStock, { ...baseEnrichment, top_creators: creators });
    expect(result.subScores.creatorInfluence).toBe(100);
  });

  it('0 creators yields creatorInfluence sub-score 0', () => {
    const result = computeOpportunityScore(baseStock, { ...baseEnrichment, top_creators: [] });
    expect(result.subScores.creatorInfluence).toBe(0);
  });

  it('weighted sum matches manual calculation', () => {
    // velocity=500→100, sentiment=1→100, social_dominance=20→100, pct_change=20→100, 5 creators→100
    const stock = { ...baseStock, velocity: 500, sentimentScore: 1 };
    const enrichment = {
      ...baseEnrichment,
      percent_change_24h: 20,
      social_dominance: 20,
      top_creators: Array.from({ length: 5 }, (_, i) => ({
        screen_name: `u${i}`, network: 'twitter', influencer_rank: 1, followers: 100000, posts: 1, engagements: 1000,
      })),
    };
    const result = computeOpportunityScore(stock, enrichment);
    // 100*0.25 + 100*0.15 + 100*0.20 + 100*0.25 + 100*0.15 = 100
    expect(result.score).toBe(100);
  });

  it('all-zero inputs yield score 0', () => {
    const zeroStock = { ...baseStock, velocity: 0, sentimentScore: -1 };
    const zeroEnrichment = {
      ...baseEnrichment,
      percent_change_24h: 0,
      social_dominance: 0,
      top_creators: [],
    };
    const result = computeOpportunityScore(zeroStock, zeroEnrichment);
    expect(result.score).toBe(0);
  });

  it('includes ticker in result', () => {
    const result = computeOpportunityScore(baseStock, baseEnrichment);
    expect(result.ticker).toBe('GME');
  });

  it('includes signalLevel in result', () => {
    const result = computeOpportunityScore(baseStock, baseEnrichment);
    expect(['hot', 'rising', 'watch', 'none']).toContain(result.signalLevel);
  });
});

describe('classifySignalLevel', () => {
  it('score >= 75 is hot', () => {
    expect(classifySignalLevel(75)).toBe('hot');
    expect(classifySignalLevel(100)).toBe('hot');
    expect(classifySignalLevel(80)).toBe('hot');
  });

  it('score 50–74 is rising', () => {
    expect(classifySignalLevel(50)).toBe('rising');
    expect(classifySignalLevel(74)).toBe('rising');
    expect(classifySignalLevel(60)).toBe('rising');
  });

  it('score 30–49 is watch', () => {
    expect(classifySignalLevel(30)).toBe('watch');
    expect(classifySignalLevel(49)).toBe('watch');
    expect(classifySignalLevel(40)).toBe('watch');
  });

  it('score < 30 is none', () => {
    expect(classifySignalLevel(0)).toBe('none');
    expect(classifySignalLevel(29)).toBe('none');
    expect(classifySignalLevel(10)).toBe('none');
  });
});
