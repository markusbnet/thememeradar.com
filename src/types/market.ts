export interface StockPriceSnapshot {
  ticker: string;
  timestamp: number;
  price: number;
  changePct24h: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  previousClose: number;
  staleness: 'fresh' | 'normal' | 'grey' | 'drop';
  fetchedAt: number;
  ttl: number;
}

export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}
