import { detectCreatorSignal, normalizeCreatorScore } from '@/lib/creators';
import type { LunarCrushCreator } from '@/types/lunarcrush';

const makeCreator = (overrides: Partial<LunarCrushCreator> = {}): LunarCrushCreator => ({
  screen_name: 'testuser',
  network: 'twitter',
  influencer_rank: 200,
  followers: 50_000,
  posts: 3,
  engagements: 1_000,
  ...overrides,
});

describe('detectCreatorSignal', () => {
  it('returns false for empty array', () => {
    expect(detectCreatorSignal([])).toBe(false);
  });

  it('returns true when any creator has influencer_rank <= 100', () => {
    const creators = [
      makeCreator({ influencer_rank: 200, followers: 10_000 }),
      makeCreator({ influencer_rank: 50, followers: 10_000 }),
    ];
    expect(detectCreatorSignal(creators)).toBe(true);
  });

  it('returns true when any creator has followers > 100000', () => {
    const creators = [
      makeCreator({ influencer_rank: 500, followers: 50_000 }),
      makeCreator({ influencer_rank: 300, followers: 150_000 }),
    ];
    expect(detectCreatorSignal(creators)).toBe(true);
  });

  it('returns false when all creators have rank > 100 AND followers <= 100000', () => {
    const creators = [
      makeCreator({ influencer_rank: 150, followers: 80_000 }),
      makeCreator({ influencer_rank: 500, followers: 100_000 }),
    ];
    expect(detectCreatorSignal(creators)).toBe(false);
  });
});

describe('normalizeCreatorScore', () => {
  it('returns 0 for empty array', () => {
    expect(normalizeCreatorScore([])).toBe(0);
  });

  it('returns higher score for creators with more followers', () => {
    const lowFollowers = [makeCreator({ influencer_rank: 50, followers: 1_000 })];
    const highFollowers = [makeCreator({ influencer_rank: 50, followers: 1_000_000 })];
    expect(normalizeCreatorScore(highFollowers)).toBeGreaterThan(normalizeCreatorScore(lowFollowers));
  });

  it('returns 100 for a top-ranked creator (rank <= 10)', () => {
    const creators = [makeCreator({ influencer_rank: 1, followers: 2_000_000 })];
    expect(normalizeCreatorScore(creators)).toBe(100);
  });

  it('caps at 100', () => {
    const creators = [
      makeCreator({ influencer_rank: 1, followers: 10_000_000 }),
      makeCreator({ influencer_rank: 1, followers: 10_000_000 }),
    ];
    expect(normalizeCreatorScore(creators)).toBeLessThanOrEqual(100);
  });
});
