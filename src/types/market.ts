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

export interface FinnhubNewsItem {
  category: string;
  datetime: number; // Unix seconds
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubShortInterestItem {
  date: string;
  long: number;
  settleDate: string;
  short: number;
  shortPercent: number; // percentage value, e.g. 5.23 = 5.23%
  symbol: string;
}

export interface FinnhubInsiderTransaction {
  name: string;
  change: number;       // positive = bought, negative = sold
  share: number;        // total shares held after transaction
  transactionCode: string; // P=purchase, S=sale, A=award, F=tax, G=gift
  transactionDate: string; // YYYY-MM-DD
  transactionPrice: number;
  filingDate: string;
  isDerivative: boolean;
  symbol: string;
}
