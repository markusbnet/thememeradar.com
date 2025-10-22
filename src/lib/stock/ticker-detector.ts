/**
 * Stock Ticker Detection Module
 * Extracts and validates stock tickers from text (Reddit posts/comments)
 */

import tickerData from '@/data/valid-tickers.json';

// Regex patterns for ticker extraction
const PATTERNS = {
  // Matches $SYMBOL format (e.g., $GME, $TSLA)
  // Minimum 2 letters, maximum 5 letters
  dollarSign: /\$([A-Z]{2,5})\b/gi,

  // Matches standalone uppercase words (2-5 letters)
  // Uses word boundaries to avoid matching within words
  standalone: /\b([A-Z]{2,5})\b/g,
};

// Common words/acronyms to exclude (even if they match ticker pattern)
const BLACKLIST_SET = new Set(
  tickerData.blacklist.map(word => word.toUpperCase())
);

// Valid tickers from our curated list
const VALID_TICKERS_SET = new Set(
  tickerData.tickers.map(ticker => ticker.toUpperCase())
);

/**
 * Extract potential tickers from text
 * Returns both $SYMBOL and standalone SYMBOL patterns
 * Does NOT validate against ticker list (use filterTickers for that)
 */
export function extractTickers(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const found: string[] = [];

  // Extract $SYMBOL format tickers
  const dollarMatches = text.matchAll(PATTERNS.dollarSign);
  for (const match of dollarMatches) {
    if (match[1]) {
      found.push(match[1].toUpperCase());
    }
  }

  // Extract standalone uppercase tickers (2-5 letters)
  // Skip URLs and common words
  const standaloneMatches = text.matchAll(PATTERNS.standalone);
  for (const match of standaloneMatches) {
    if (match[1]) {
      const ticker = match[1].toUpperCase();

      // Skip if it's part of a URL pattern
      const matchIndex = match.index || 0;
      const before = text.substring(Math.max(0, matchIndex - 15), matchIndex);
      const after = text.substring(matchIndex, Math.min(text.length, matchIndex + ticker.length + 15));

      // Skip if near URL indicators (case insensitive)
      const beforeLower = before.toLowerCase();
      const afterLower = after.toLowerCase();

      // Check if part of URL/domain
      const isPartOfURL =
        beforeLower.includes('http') ||
        beforeLower.includes('www.') ||
        beforeLower.includes('://') ||
        afterLower.includes('.com') ||
        afterLower.includes('.net') ||
        afterLower.includes('.org') ||
        afterLower.includes('.io');

      if (isPartOfURL) {
        continue;
      }

      found.push(ticker);
    }
  }

  // Deduplicate while preserving order
  return [...new Set(found)];
}

/**
 * Validate if a ticker is legitimate
 * Checks against blacklist and valid tickers list
 */
export function validateTicker(ticker: string | null | undefined): boolean {
  if (!ticker || typeof ticker !== 'string') {
    return false;
  }

  const normalized = ticker.toUpperCase().trim();

  // Empty or too short
  if (normalized.length === 0) {
    return false;
  }

  // Check blacklist first (faster rejection)
  if (BLACKLIST_SET.has(normalized)) {
    return false;
  }

  // Check if in valid tickers list
  return VALID_TICKERS_SET.has(normalized);
}

/**
 * Filter tickers to only include valid ones
 * Removes blacklisted words and invalid tickers
 * Deduplicates and normalizes to uppercase
 */
export function filterTickers(tickers: string[]): string[] {
  if (!Array.isArray(tickers)) {
    return [];
  }

  const valid: string[] = [];
  const seen = new Set<string>();

  for (const ticker of tickers) {
    if (!ticker) continue;

    const normalized = ticker.toUpperCase().trim();

    // Skip if already seen (deduplication)
    if (seen.has(normalized)) {
      continue;
    }

    // Validate ticker
    if (validateTicker(normalized)) {
      valid.push(normalized);
      seen.add(normalized);
    }
  }

  return valid;
}

/**
 * Main function: Extract and filter tickers in one call
 * This is the recommended API for most use cases
 */
export function detectTickers(text: string): string[] {
  const extracted = extractTickers(text);
  return filterTickers(extracted);
}

/**
 * Get ticker statistics from text
 * Returns count of mentions per ticker
 */
export function getTickerCounts(text: string): Map<string, number> {
  const tickers = detectTickers(text);
  const counts = new Map<string, number>();

  // Re-scan text to count occurrences
  for (const ticker of tickers) {
    // Count both $TICKER and TICKER mentions
    const dollarPattern = new RegExp(`\\$${ticker}\\b`, 'gi');
    const standalonePattern = new RegExp(`\\b${ticker}\\b`, 'g');

    const dollarMatches = (text.match(dollarPattern) || []).length;
    const standaloneMatches = (text.match(standalonePattern) || []).length;

    counts.set(ticker, dollarMatches + standaloneMatches);
  }

  return counts;
}

/**
 * Check if text contains any valid tickers
 */
export function hasTickers(text: string): boolean {
  return detectTickers(text).length > 0;
}

/**
 * Get summary statistics about ticker detection
 * Useful for debugging and analytics
 */
export interface TickerStats {
  totalExtracted: number;
  totalValid: number;
  validTickers: string[];
  invalidTickers: string[];
  blacklistedWords: string[];
}

export function getTickerStats(text: string): TickerStats {
  const extracted = extractTickers(text);
  const valid = filterTickers(extracted);

  const invalidTickers: string[] = [];
  const blacklistedWords: string[] = [];

  for (const ticker of extracted) {
    const normalized = ticker.toUpperCase();

    if (!valid.includes(normalized)) {
      if (BLACKLIST_SET.has(normalized)) {
        blacklistedWords.push(normalized);
      } else {
        invalidTickers.push(normalized);
      }
    }
  }

  return {
    totalExtracted: extracted.length,
    totalValid: valid.length,
    validTickers: valid,
    invalidTickers: [...new Set(invalidTickers)],
    blacklistedWords: [...new Set(blacklistedWords)],
  };
}
