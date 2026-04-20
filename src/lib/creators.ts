import type { LunarCrushCreator } from '@/types/lunarcrush';

/** Returns true if any creator is a notable influencer (rank <= 100 or followers > 100K) */
export function detectCreatorSignal(creators: LunarCrushCreator[]): boolean {
  if (!creators || creators.length === 0) return false;
  return creators.some(c => c.influencer_rank <= 100 || c.followers > 100_000);
}

/**
 * Normalize creator influence to 0–100.
 * Score is based on: best single creator's followers and rank.
 * - influencer_rank <= 10 and followers > 1M → 100
 * - influencer_rank <= 50 or followers > 100K → 60–80
 * - lower rank/followers → proportionally lower
 */
export function normalizeCreatorScore(creators: LunarCrushCreator[]): number {
  if (!creators || creators.length === 0) return 0;

  // Find the best creator (lowest rank = most influential)
  const best = creators.reduce((prev, curr) =>
    curr.influencer_rank < prev.influencer_rank ? curr : prev
  );

  // Rank score: rank 1 → 100, rank 100 → 0 (linear)
  const rankScore = Math.max(0, Math.min(100, (100 - best.influencer_rank) + 1));

  // Follower score: log scale, 1M+ → 100
  const followerScore = best.followers > 0
    ? Math.min(100, Math.log10(best.followers) / Math.log10(1_000_000) * 100)
    : 0;

  // Combined: 60% rank + 40% followers
  return Math.round(rankScore * 0.6 + followerScore * 0.4);
}
