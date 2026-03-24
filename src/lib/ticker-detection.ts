/**
 * Stock Ticker Detection
 * Extracts stock ticker symbols from text
 * Validates against a whitelist of known NYSE/NASDAQ tickers
 */

import { TICKER_WHITELIST } from './ticker-list';

// Real tickers that are also common English words — require $ prefix to avoid false positives
const AMBIGUOUS_TICKERS = new Set([
  'IT', 'ARE', 'ON', 'ALL', 'A', 'BE', 'AN', 'OR', 'SO', 'DO',
  'AT', 'BY', 'TO', 'IN', 'AI', 'AM', 'PM', 'HR', 'IP',
  'K', 'L', 'J', 'U', 'S', 'W', 'H',
  'NOW', 'SEE', 'HAS', 'ONE', 'TWO', 'NEW', 'OLD', 'DAY',
  'OUT', 'CAN', 'MAN', 'HIM', 'HIS', 'HER', 'WAY', 'BIG',
  'LOW', 'KEY', 'HE', 'WE', 'GO', 'DD', 'RE', 'FL', 'CE',
  'EDIT', 'FAST', 'OPEN', 'WELL', 'ALLY', 'FIVE', 'REAL',
  'GRAB', 'TRUE', 'GOLD', 'BIRD', 'CHEF', 'DISH', 'RARE',
  'PEAK', 'POOL', 'TELL', 'SAVE', 'RIDE',
]);

/**
 * Check if a string is a valid stock ticker
 * - Must be 1-5 uppercase letters
 * - Single letters are not valid (except with $ prefix)
 * - Ambiguous tickers (common words) require $ prefix
 * - Must be in the NYSE/NASDAQ whitelist
 */
export function isValidTicker(symbol: string, hasDollarSign: boolean = false): boolean {
  // Must be 1-5 letters
  if (symbol.length < 1 || symbol.length > 5) {
    return false;
  }

  // Must be all uppercase
  if (symbol !== symbol.toUpperCase()) {
    return false;
  }

  // Single letter symbols only valid with $
  if (symbol.length === 1 && !hasDollarSign) {
    return false;
  }

  // Ambiguous tickers (common words) require $ prefix
  if (AMBIGUOUS_TICKERS.has(symbol) && !hasDollarSign) {
    return false;
  }

  // Must be a known NYSE/NASDAQ ticker
  if (!TICKER_WHITELIST.has(symbol)) {
    return false;
  }

  return true;
}

/**
 * Extract stock tickers from text
 * Supports:
 * - $SYMBOL format (e.g., $GME, $TSLA)
 * - Standalone uppercase 2-5 letter words (e.g., AAPL, GME)
 */
export function extractTickers(text: string): string[] {
  if (!text) return [];

  const tickers = new Set<string>();

  // Pattern 1: $SYMBOL format (allows single letter like $F)
  const dollarPattern = /\$([A-Z]{1,5})\b/g;
  let match;

  while ((match = dollarPattern.exec(text)) !== null) {
    const symbol = match[1];
    if (isValidTicker(symbol, true)) {
      tickers.add(symbol);
    }
  }

  // Pattern 2: Standalone uppercase 2-5 letter words
  // Must be surrounded by word boundaries or whitespace
  const standalonePattern = /\b([A-Z]{2,5})\b/g;

  while ((match = standalonePattern.exec(text)) !== null) {
    const symbol = match[1];
    if (isValidTicker(symbol, false)) {
      tickers.add(symbol);
    }
  }

  return Array.from(tickers).sort();
}
