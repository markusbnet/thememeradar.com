export interface ApewisdomRow {
  rank: number;
  rank_24h_ago: number | null;
  ticker: string;
  name: string;
  mentions: number;
  mentions_24h_ago: number;
  upvotes: number;
}

export interface ApewisdomSnapshot {
  subreddit: string;
  fetchedAt: number;
  rows: ApewisdomRow[];
  ttl: number;
}

export interface ApewisdomIngestPayload {
  subreddit: string;
  rows: ApewisdomRow[];
  fetchedAt: number;
}

export type CoverageSource = 'reddit' | 'apewisdom' | 'both';
