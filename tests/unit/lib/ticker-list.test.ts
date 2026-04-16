/**
 * Ticker Whitelist Tests
 * Sanity-check that the NYSE/NASDAQ whitelist contains the tickers we rely on
 * (mega caps, meme stocks, major ETFs) so ticker extraction doesn't silently
 * drop well-known symbols after future edits.
 */

import { TICKER_WHITELIST } from '@/lib/ticker-list';

describe('TICKER_WHITELIST', () => {
  it('should be a Set of strings', () => {
    expect(TICKER_WHITELIST).toBeInstanceOf(Set);
  });

  it('should contain popular meme stocks (GME, AMC, BB, PLTR, SOFI)', () => {
    expect(TICKER_WHITELIST.has('GME')).toBe(true);
    expect(TICKER_WHITELIST.has('AMC')).toBe(true);
    expect(TICKER_WHITELIST.has('BB')).toBe(true);
    expect(TICKER_WHITELIST.has('PLTR')).toBe(true);
    expect(TICKER_WHITELIST.has('SOFI')).toBe(true);
  });

  it('should contain major mega-cap tickers (AAPL, MSFT, TSLA, NVDA, GOOGL)', () => {
    expect(TICKER_WHITELIST.has('AAPL')).toBe(true);
    expect(TICKER_WHITELIST.has('MSFT')).toBe(true);
    expect(TICKER_WHITELIST.has('TSLA')).toBe(true);
    expect(TICKER_WHITELIST.has('NVDA')).toBe(true);
    expect(TICKER_WHITELIST.has('GOOGL')).toBe(true);
  });

  it('should contain major ETFs (SPY, QQQ, VOO, ARKK)', () => {
    expect(TICKER_WHITELIST.has('SPY')).toBe(true);
    expect(TICKER_WHITELIST.has('QQQ')).toBe(true);
    expect(TICKER_WHITELIST.has('VOO')).toBe(true);
    expect(TICKER_WHITELIST.has('ARKK')).toBe(true);
  });

  it('should have a reasonable size (>= 400 tickers)', () => {
    // The hand-curated list covers S&P 500, NASDAQ-100, meme stocks, and ETFs.
    // If it drops below 400, someone likely accidentally truncated the list.
    expect(TICKER_WHITELIST.size).toBeGreaterThanOrEqual(400);
  });

  it('should not contain common false-positive English words', () => {
    // The whitelist should only contain real tickers, never common English words.
    // Note: some 3-letter words like ARE (Alexandria Real Estate) and HAS (Hasbro)
    // ARE valid tickers — only assert against words that are unambiguously not tickers.
    expect(TICKER_WHITELIST.has('FOR')).toBe(false);
    expect(TICKER_WHITELIST.has('THE')).toBe(false);
    expect(TICKER_WHITELIST.has('YOU')).toBe(false);
    expect(TICKER_WHITELIST.has('WHY')).toBe(false);
    expect(TICKER_WHITELIST.has('HOW')).toBe(false);
  });
});
