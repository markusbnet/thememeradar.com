// LunarCrush API v4 — type definitions

export interface LunarCrushStockSummary {
  symbol: string;
  name: string;
  price: number;
  volume: number;
  percent_change_24h: number;
  market_cap: number;
  galaxy_score: number;
  alt_rank: number;
  sentiment: number;        // 1–5 scale (3 = neutral)
  social_dominance: number; // 0–100 share of social volume vs peers
}

export interface LunarCrushCreator {
  screen_name: string;
  network: string;
  influencer_rank: number;
  followers: number;
  posts: number;
  engagements: number;
}

export interface LunarCrushTopicDetail {
  symbol: string;
  name: string;
  price: number;
  volume_24h: number;
  percent_change_24h: number;
  market_cap: number;
  galaxy_score: number;
  alt_rank: number;
  sentiment: number;
  social_dominance: number;
  interactions: number;
  posts_active: number;
  contributors_active: number;
  engagements_by_network: Record<string, number>;
  mentions_by_network: Record<string, number>;
  top_creators: LunarCrushCreator[];
}

export interface LunarCrushTimeSeriesPoint {
  time: number; // unix timestamp in seconds
  close: number;
  volume_24h: number;
  sentiment: number;
  social_dominance: number;
  interactions: number;
  posts_active: number;
}

export type LunarCrushTimeSeries = LunarCrushTimeSeriesPoint[];

export interface LunarCrushPost {
  network: string;
  creator: string;
  text: string;
  engagements: number;
  created_at: number; // unix timestamp in seconds
  url: string;
}
