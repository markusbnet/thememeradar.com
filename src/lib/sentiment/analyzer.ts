/**
 * Sentiment Analysis Module
 * Analyzes text sentiment using wallstreetbets terminology and emojis
 */

import keywordsData from '@/data/sentiment-keywords.json';

// Type definitions
export interface KeywordMatch {
  keyword: string;
  weight: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface ExtractedKeywords {
  bullish: string[];
  bearish: string[];
  neutral: string[];
}

export type SentimentCategory =
  | 'strong_bullish'
  | 'bullish'
  | 'neutral'
  | 'bearish'
  | 'strong_bearish';

export interface SentimentResult {
  ticker: string;
  score: number; // -1.0 to 1.0
  category: SentimentCategory;
  keywords: ExtractedKeywords;
  reasoning: string;
  bullishWeight: number;
  bearishWeight: number;
  neutralWeight: number;
}

export interface BulkSentimentResult {
  ticker: string;
  averageScore: number;
  category: SentimentCategory;
  sampleSize: number;
  individualResults: SentimentResult[];
  topKeywords: ExtractedKeywords;
}

// Pre-process keywords into lookup structures
const BULLISH_KEYWORDS = new Map<string, number>();
const BEARISH_KEYWORDS = new Map<string, number>();
const NEUTRAL_KEYWORDS = new Map<string, number>();

// Initialize keyword maps
for (const [keyword, data] of Object.entries(keywordsData.bullish)) {
  BULLISH_KEYWORDS.set(keyword.toLowerCase(), data.weight);
}
for (const [keyword, data] of Object.entries(keywordsData.bearish)) {
  BEARISH_KEYWORDS.set(keyword.toLowerCase(), data.weight);
}
for (const [keyword, data] of Object.entries(keywordsData.neutral)) {
  NEUTRAL_KEYWORDS.set(keyword.toLowerCase(), data.weight);
}

/**
 * Check if keyword matches in text with word boundaries
 * For multi-word phrases, uses simple includes
 * For single words, uses word boundary regex to avoid partial matches
 */
function matchesKeyword(text: string, keyword: string): boolean {
  // For emojis or multi-word phrases, use simple includes
  if (keyword.includes(' ') || /[\u{1F000}-\u{1F9FF}]/u.test(keyword)) {
    return text.includes(keyword);
  }

  // For single words, use word boundary regex
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
  return regex.test(text);
}

/**
 * Extract sentiment keywords from text
 * Returns matched keywords organized by sentiment type
 */
export function extractKeywords(text: string): ExtractedKeywords {
  if (!text || typeof text !== 'string') {
    return { bullish: [], bearish: [], neutral: [] };
  }

  const textLower = text.toLowerCase();
  const bullish: string[] = [];
  const bearish: string[] = [];
  const neutral: string[] = [];

  // Check for bullish keywords
  for (const [originalKeyword] of Object.entries(keywordsData.bullish)) {
    if (matchesKeyword(textLower, originalKeyword.toLowerCase())) {
      bullish.push(originalKeyword);
    }
  }

  // Check for bearish keywords
  for (const [originalKeyword] of Object.entries(keywordsData.bearish)) {
    if (matchesKeyword(textLower, originalKeyword.toLowerCase())) {
      bearish.push(originalKeyword);
    }
  }

  // Check for neutral keywords
  for (const [originalKeyword] of Object.entries(keywordsData.neutral)) {
    if (matchesKeyword(textLower, originalKeyword.toLowerCase())) {
      neutral.push(originalKeyword);
    }
  }

  return { bullish, bearish, neutral };
}

/**
 * Calculate sentiment score from text
 * Returns score from -1.0 (very bearish) to 1.0 (very bullish)
 */
export function calculateSentimentScore(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const keywords = extractKeywords(text);

  // Calculate weighted scores
  let bullishWeight = 0;
  let bearishWeight = 0;
  let neutralWeight = 0;

  for (const keyword of keywords.bullish) {
    const weight = BULLISH_KEYWORDS.get(keyword.toLowerCase()) || 1;
    bullishWeight += weight;
  }

  for (const keyword of keywords.bearish) {
    const weight = BEARISH_KEYWORDS.get(keyword.toLowerCase()) || 1;
    bearishWeight += weight;
  }

  for (const keyword of keywords.neutral) {
    const weight = NEUTRAL_KEYWORDS.get(keyword.toLowerCase()) || 0;
    neutralWeight += weight;
  }

  // Calculate net score
  const netWeight = bullishWeight - bearishWeight;
  const totalWeight = bullishWeight + bearishWeight + neutralWeight;

  if (totalWeight === 0) {
    return 0; // No sentiment keywords found
  }

  // Normalize to -1 to 1 range using tanh for smooth scaling
  // Scaling factor of 5 means a net weight of 5 ≈ 0.76 score, 10 ≈ 0.96 score
  const normalizedScore = Math.tanh(netWeight / 5);

  return parseFloat(normalizedScore.toFixed(3));
}

/**
 * Categorize sentiment score into human-readable categories
 */
export function getSentimentCategory(score: number): SentimentCategory {
  if (score > 0.6) return 'strong_bullish';
  if (score > 0.2) return 'bullish';
  if (score >= -0.2) return 'neutral';
  if (score >= -0.6) return 'bearish';
  return 'strong_bearish';
}

/**
 * Generate reasoning text explaining the sentiment score
 */
function generateReasoning(
  score: number,
  keywords: ExtractedKeywords,
  bullishWeight: number,
  bearishWeight: number
): string {
  const category = getSentimentCategory(score);
  const parts: string[] = [];

  // Main sentiment statement
  if (category === 'strong_bullish') {
    parts.push('Very strong bullish sentiment detected.');
  } else if (category === 'bullish') {
    parts.push('Bullish sentiment detected.');
  } else if (category === 'neutral') {
    parts.push('Neutral sentiment with balanced or minimal indicators.');
  } else if (category === 'bearish') {
    parts.push('Bearish sentiment detected.');
  } else {
    parts.push('Very strong bearish sentiment detected.');
  }

  // Bullish keywords
  if (keywords.bullish.length > 0) {
    const topBullish = keywords.bullish.slice(0, 3).join(', ');
    parts.push(
      `Bullish indicators: ${topBullish} (weight: ${bullishWeight.toFixed(1)}).`
    );
  }

  // Bearish keywords
  if (keywords.bearish.length > 0) {
    const topBearish = keywords.bearish.slice(0, 3).join(', ');
    parts.push(
      `Bearish indicators: ${topBearish} (weight: ${bearishWeight.toFixed(1)}).`
    );
  }

  // Score summary
  parts.push(`Overall score: ${score.toFixed(2)}.`);

  return parts.join(' ');
}

/**
 * Extract context around ticker mention
 * Returns ±50 words around the ticker
 */
function extractContext(text: string, ticker: string, wordRadius: number = 50): string {
  if (!text || !ticker) return text;

  const regex = new RegExp(`\\b${ticker}\\b|\\$${ticker}\\b`, 'gi');
  const match = regex.exec(text);

  if (!match) {
    // Ticker not found, return whole text
    return text;
  }

  const matchIndex = match.index;
  const words = text.split(/\s+/);

  // Find word index of match
  let wordIndex = 0;
  let charCount = 0;
  for (let i = 0; i < words.length; i++) {
    if (charCount >= matchIndex) {
      wordIndex = i;
      break;
    }
    charCount += words[i].length + 1; // +1 for space
  }

  // Extract ±50 words
  const startIndex = Math.max(0, wordIndex - wordRadius);
  const endIndex = Math.min(words.length, wordIndex + wordRadius + 1);

  return words.slice(startIndex, endIndex).join(' ');
}

/**
 * Analyze sentiment for a specific ticker in text
 * Returns complete sentiment analysis result
 */
export function analyzeSentiment(text: string, ticker: string): SentimentResult {
  if (!text || typeof text !== 'string') {
    return {
      ticker,
      score: 0,
      category: 'neutral',
      keywords: { bullish: [], bearish: [], neutral: [] },
      reasoning: 'No text provided for analysis.',
      bullishWeight: 0,
      bearishWeight: 0,
      neutralWeight: 0,
    };
  }

  // Extract context around ticker mention (±50 words)
  const context = extractContext(text, ticker);

  // Extract keywords from context
  const keywords = extractKeywords(context);

  // Calculate weights
  let bullishWeight = 0;
  let bearishWeight = 0;
  let neutralWeight = 0;

  for (const keyword of keywords.bullish) {
    bullishWeight += BULLISH_KEYWORDS.get(keyword.toLowerCase()) || 1;
  }
  for (const keyword of keywords.bearish) {
    bearishWeight += BEARISH_KEYWORDS.get(keyword.toLowerCase()) || 1;
  }
  for (const keyword of keywords.neutral) {
    neutralWeight += NEUTRAL_KEYWORDS.get(keyword.toLowerCase()) || 0;
  }

  // Calculate score
  const score = calculateSentimentScore(context);
  const category = getSentimentCategory(score);

  // Generate reasoning
  const reasoning = generateReasoning(score, keywords, bullishWeight, bearishWeight);

  return {
    ticker,
    score,
    category,
    keywords,
    reasoning,
    bullishWeight,
    bearishWeight,
    neutralWeight,
  };
}

/**
 * Analyze sentiment across multiple texts (bulk analysis)
 * Useful for analyzing multiple posts/comments about the same ticker
 */
export function analyzeBulkSentiment(
  texts: string[],
  ticker: string
): BulkSentimentResult {
  if (!Array.isArray(texts) || texts.length === 0) {
    return {
      ticker,
      averageScore: 0,
      category: 'neutral',
      sampleSize: 0,
      individualResults: [],
      topKeywords: { bullish: [], bearish: [], neutral: [] },
    };
  }

  // Analyze each text individually
  const individualResults = texts.map((text) => analyzeSentiment(text, ticker));

  // Calculate average score
  const totalScore = individualResults.reduce((sum, result) => sum + result.score, 0);
  const averageScore = totalScore / individualResults.length;
  const category = getSentimentCategory(averageScore);

  // Aggregate keywords (frequency count)
  const bullishKeywordCounts = new Map<string, number>();
  const bearishKeywordCounts = new Map<string, number>();
  const neutralKeywordCounts = new Map<string, number>();

  for (const result of individualResults) {
    for (const keyword of result.keywords.bullish) {
      bullishKeywordCounts.set(keyword, (bullishKeywordCounts.get(keyword) || 0) + 1);
    }
    for (const keyword of result.keywords.bearish) {
      bearishKeywordCounts.set(keyword, (bearishKeywordCounts.get(keyword) || 0) + 1);
    }
    for (const keyword of result.keywords.neutral) {
      neutralKeywordCounts.set(keyword, (neutralKeywordCounts.get(keyword) || 0) + 1);
    }
  }

  // Get top keywords (sorted by frequency)
  const sortKeywords = (map: Map<string, number>): string[] => {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([keyword]) => keyword);
  };

  const topKeywords: ExtractedKeywords = {
    bullish: sortKeywords(bullishKeywordCounts).slice(0, 10),
    bearish: sortKeywords(bearishKeywordCounts).slice(0, 10),
    neutral: sortKeywords(neutralKeywordCounts).slice(0, 10),
  };

  return {
    ticker,
    averageScore: parseFloat(averageScore.toFixed(3)),
    category,
    sampleSize: texts.length,
    individualResults,
    topKeywords,
  };
}

/**
 * Get sentiment emoji based on category
 */
export function getSentimentEmoji(category: SentimentCategory): string {
  const emojiMap: Record<SentimentCategory, string> = {
    strong_bullish: '🚀',
    bullish: '📈',
    neutral: '😐',
    bearish: '📉',
    strong_bearish: '💥',
  };

  return emojiMap[category];
}

/**
 * Get sentiment label (human-readable)
 */
export function getSentimentLabel(category: SentimentCategory): string {
  const labelMap: Record<SentimentCategory, string> = {
    strong_bullish: 'Strong Bullish',
    bullish: 'Bullish',
    neutral: 'Neutral',
    bearish: 'Bearish',
    strong_bearish: 'Strong Bearish',
  };

  return labelMap[category];
}
