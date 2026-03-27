import { computeSurgeScore, DEFAULT_SURGE_CONFIG, SurgeConfig } from '@/lib/db/surge';

describe('computeSurgeScore', () => {
  it('should return null when currentMentions < minAbsoluteMentions', () => {
    const result = computeSurgeScore(3, 1, DEFAULT_SURGE_CONFIG);
    expect(result).toBeNull();
  });

  it('should return score 1.0 when baselineAvg is 0 and currentMentions >= minimum', () => {
    const result = computeSurgeScore(15, 0, DEFAULT_SURGE_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(1.0);
    expect(result!.multiplier).toBe(Infinity);
  });

  it('should return null when baselineAvg is 0 and currentMentions < minimum', () => {
    const result = computeSurgeScore(3, 0, DEFAULT_SURGE_CONFIG);
    expect(result).toBeNull();
  });

  it('should return null when multiplier < surgeMultiplier threshold', () => {
    // 15 / 10 = 1.5x, below default 3x threshold
    const result = computeSurgeScore(15, 10, DEFAULT_SURGE_CONFIG);
    expect(result).toBeNull();
  });

  it('should return valid score when multiplier equals surgeMultiplier exactly', () => {
    // 30 / 10 = 3.0x, exactly at threshold
    const result = computeSurgeScore(30, 10, DEFAULT_SURGE_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.multiplier).toBe(3);
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThanOrEqual(1);
  });

  it('should return higher score for larger multipliers (monotonically increasing)', () => {
    const score3x = computeSurgeScore(30, 10, DEFAULT_SURGE_CONFIG)!;
    const score6x = computeSurgeScore(60, 10, DEFAULT_SURGE_CONFIG)!;
    const score12x = computeSurgeScore(120, 10, DEFAULT_SURGE_CONFIG)!;

    expect(score6x.score).toBeGreaterThan(score3x.score);
    expect(score12x.score).toBeGreaterThan(score6x.score);
  });

  it('should have score bounded between 0 and 1', () => {
    // Test with very large multiplier
    const result = computeSurgeScore(10000, 10, DEFAULT_SURGE_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThanOrEqual(1);
  });

  it('should correctly calculate multiplier as currentMentions / baselineAvg', () => {
    const result = computeSurgeScore(50, 10, DEFAULT_SURGE_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.multiplier).toBe(5);
  });

  it('should respect custom config for minAbsoluteMentions', () => {
    const config: SurgeConfig = { minAbsoluteMentions: 20, surgeMultiplier: 3 };
    // 15 mentions is above default (10) but below custom (20)
    const result = computeSurgeScore(15, 3, config);
    expect(result).toBeNull();

    // 25 mentions meets custom threshold and 25/3 = 8.3x > 3x
    const result2 = computeSurgeScore(25, 3, config);
    expect(result2).not.toBeNull();
  });

  it('should respect custom config for surgeMultiplier', () => {
    const config: SurgeConfig = { minAbsoluteMentions: 10, surgeMultiplier: 5 };
    // 30/10 = 3x, below custom 5x threshold
    const result = computeSurgeScore(30, 10, config);
    expect(result).toBeNull();

    // 60/10 = 6x, above custom 5x threshold
    const result2 = computeSurgeScore(60, 10, config);
    expect(result2).not.toBeNull();
  });
});
