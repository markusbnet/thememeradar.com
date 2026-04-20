export interface OptionsActivity {
  ticker: string;
  timestamp: number;
  callOpenInterest: number;
  putOpenInterest: number;
  putCallRatio: number;
  iv30d: number | null;
  fetchedAt: number;
  ttl: number;
}

export interface OptionsIngestPayload {
  rows: Array<Omit<OptionsActivity, 'ttl'>>;
}
