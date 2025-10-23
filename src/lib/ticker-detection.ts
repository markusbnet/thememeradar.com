/**
 * Stock Ticker Detection
 * Extracts stock ticker symbols from text
 */

// Common words that might be mistaken for tickers
const BLACKLIST = new Set([
  'FOR', 'IT', 'ARE', 'OR', 'ON', 'BY', 'AT', 'TO', 'IN', 'A', 'I',
  'THE', 'IS', 'AN', 'AS', 'BE', 'OF', 'AND', 'BUT', 'NOT', 'YOU',
  'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS',
  'HIM', 'HIS', 'HOW', 'MAN', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY',
  'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE',
  'DAD', 'MOM', 'YES', 'NO', 'OK', 'LOL', 'OMG', 'WTF', 'TBH', 'IMO',
  'FWIW', 'YMMV', 'TL', 'DR', 'ELI', 'AMA', 'TIL', 'PSA', 'FYI',
  'ASAP', 'DIY', 'FAQ', 'RIP', 'CEO', 'CFO', 'CTO', 'VP', 'HR',
  'PR', 'IT', 'AI', 'ML', 'API', 'SDK', 'UI', 'UX', 'PM', 'AM',
  'EDIT', 'TLDR', 'IIRC', 'AFAIK', 'IMHO', 'HODL', // HODL is slang, not a ticker
]);

/**
 * Check if a string is a valid stock ticker
 * - Must be 1-5 uppercase letters
 * - Single letters are not valid (except with $ prefix)
 * - Must not be a common word
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

  // Check blacklist
  if (BLACKLIST.has(symbol)) {
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
