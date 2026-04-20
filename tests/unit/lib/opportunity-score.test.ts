import {
  computeOpportunityScore,
  classifySignalLevel,
  type OpportunityScore,
} from '@/lib/opportunity-score';
import type { TrendingStock } from '@/lib/db/storage';
import type { StoredEnrichment } from '@/lib/db/enrichment';
import type { OptionsActivity } from '@/types/options';

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

  it('top-ranked creator (rank=1, 1M followers) yields creatorInfluence sub-score 100', () => {
    const creators = [
      { screen_name: 'influencer', network: 'twitter', influencer_rank: 1, followers: 1_000_000, posts: 5, engagements: 50000 },
    ];
    const result = computeOpportunityScore(baseStock, { ...baseEnrichment, top_creators: creators });
    expect(result.subScores.creatorInfluence).toBe(100);
  });

  it('0 creators yields creatorInfluence sub-score 0', () => {
    const result = computeOpportunityScore(baseStock, { ...baseEnrichment, top_creators: [] });
    expect(result.subScores.creatorInfluence).toBe(0);
  });

  it('weighted sum matches manual calculation', () => {
    // velocity=500→100, sentiment=1→100, social_dominance=20→100, pct_change=20→100, rank=1+1M followers→100
    const stock = { ...baseStock, velocity: 500, sentimentScore: 1 };
    const enrichment = {
      ...baseEnrichment,
      percent_change_24h: 20,
      social_dominance: 20,
      top_creators: [
        { screen_name: 'influencer', network: 'twitter', influencer_rank: 1, followers: 1_000_000, posts: 1, engagements: 1000 },
      ],
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

const baseOptions: OptionsActivity = {
  ticker: 'GME',
  timestamp: 1713600000000,
  callOpenInterest: 450000,
  putOpenInterest: 180000,
  putCallRatio: 0.40,
  iv30d: 0.85,
  fetchedAt: 1713600000000,
  ttl: 1716278400,
};

describe('computeOpportunityScore with options data', () => {
  it('without options data (default null) returns same score as 2-arg call', () => {
    const twoArg = computeOpportunityScore(baseStock, baseEnrichment);
    const threeArgNull = computeOpportunityScore(baseStock, baseEnrichment, null);
    expect(threeArgNull.score).toBe(twoArg.score);
  });

  it('with options data returns a score (may differ from no-options score)', () => {
    const withOptions = computeOpportunityScore(baseStock, baseEnrichment, baseOptions);
    expect(withOptions.score).toBeGreaterThanOrEqual(0);
    expect(withOptions.score).toBeLessThanOrEqual(100);
  });

  it('with options data the score can differ from without-options score', () => {
    // GME putCallRatio=0.40 → callPutRatio=2.5 → optionsActivityScore=83
    // This non-zero options score shifts the weighted sum away from the 5-factor result
    const withOptions = computeOpportunityScore(baseStock, baseEnrichment, baseOptions);
    const withoutOptions = computeOpportunityScore(baseStock, baseEnrichment, null);
    // The scores should differ (options weight 0.10 rebalances everything)
    expect(withOptions.score).not.toBe(withoutOptions.score);
  });

  it('subScores includes optionsActivity when options provided', () => {
    const result = computeOpportunityScore(baseStock, baseEnrichment, baseOptions);
    expect(result.subScores.optionsActivity).toBeDefined();
  });

  it('subScores does NOT include optionsActivity when options is null', () => {
    const result = computeOpportunityScore(baseStock, baseEnrichment, null);
    expect(result.subScores.optionsActivity).toBeUndefined();
  });

  it('optionsActivityScore for GME (putCallRatio=0.40) is 83', () => {
    // callPutRatio = 1/0.40 = 2.5; min(2.5,3)/3*100 = 83.33 → floor/round to 83
    const result = computeOpportunityScore(baseStock, baseEnrichment, baseOptions);
    expect(result.subScores.optionsActivity).toBe(83);
  });

  it('optionsActivityScore for AMC (putCallRatio=1.50) is 22', () => {
    // callPutRatio = 1/1.50 = 0.667; min(0.667,3)/3*100 = 22.22 → round to 22
    const amcOptions: OptionsActivity = { ...baseOptions, ticker: 'AMC', putCallRatio: 1.50 };
    const result = computeOpportunityScore(baseStock, baseEnrichment, amcOptions);
    expect(result.subScores.optionsActivity).toBe(22);
  });

  it('optionsActivityScore caps at 100 for very bullish (putCallRatio=0.1)', () => {
    // callPutRatio = 1/0.1 = 10; min(10,3)/3*100 = 100
    const bullishOptions: OptionsActivity = { ...baseOptions, putCallRatio: 0.1 };
    const result = computeOpportunityScore(baseStock, baseEnrichment, bullishOptions);
    expect(result.subScores.optionsActivity).toBe(100);
  });

  it('all weights sum to 1.0 when options provided (implicit in score = max 100 at all 100)', () => {
    // Verify: all sub-scores=100 with options should yield score=100
    const stock = { ...baseStock, velocity: 500, sentimentScore: 1 };
    const enrichment = {
      ...baseEnrichment,
      percent_change_24h: 20,
      social_dominance: 20,
      top_creators: [
        { screen_name: 'influencer', network: 'twitter', influencer_rank: 1, followers: 1_000_000, posts: 1, engagements: 1000 },
      ],
    };
    const opts: OptionsActivity = { ...baseOptions, putCallRatio: 0.01 }; // callPutRatio=100→capped=100
    const result = computeOpportunityScore(stock, enrichment, opts);
    // 100*0.225 + 100*0.135 + 100*0.18 + 100*0.225 + 100*0.135 + 100*0.10 = 100
    expect(result.score).toBe(100);
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
