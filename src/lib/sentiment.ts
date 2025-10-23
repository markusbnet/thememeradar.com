/**
 * Sentiment Analysis Engine
 * Analyzes text for WSB terminology and assigns sentiment scores
 */

export interface SentimentKeyword {
  pattern: RegExp;
  weight: number;
  label: string;
}

export interface SentimentResult {
  score: number; // -1 to 1
  bullishKeywords: string[];
  bearishKeywords: string[];
  category: string;
}

// Bullish keywords (weighted high to low)
export const BULLISH_KEYWORDS: SentimentKeyword[] = [
  // High weight (3 points)
  { pattern: /diamond\s+hands?|💎\s*🙌/gi, weight: 3, label: 'diamond hands' },
  { pattern: /to\s+the\s+moon|🚀/gi, weight: 3, label: 'to the moon' },
  { pattern: /\byolo\b/gi, weight: 3, label: 'yolo' },
  { pattern: /\bdd\b|due\s+diligence/gi, weight: 3, label: 'dd' },
  { pattern: /\bhodl\b/gi, weight: 3, label: 'hodl' },
  { pattern: /short\s+squeeze/gi, weight: 3, label: 'short squeeze' },
  { pattern: /gamma\s+squeeze/gi, weight: 3, label: 'gamma squeeze' },

  // Medium weight (2 points)
  { pattern: /\bapes?\b|🦍/gi, weight: 2, label: 'apes' },
  { pattern: /tendies|🍗/gi, weight: 2, label: 'tendies' },
  { pattern: /buy\s+the\s+dip/gi, weight: 2, label: 'buy the dip' },
  { pattern: /\blong\b/gi, weight: 2, label: 'long' },
  { pattern: /\bcalls?\b/gi, weight: 2, label: 'calls' },
  { pattern: /\bbrr+\b/gi, weight: 2, label: 'brrrr' },
  { pattern: /\bbullish\b/gi, weight: 2, label: 'bullish' },

  // Low weight (1 point)
  { pattern: /\bstonks?\b/gi, weight: 1, label: 'stonk' },
];

// Bearish keywords (weighted high to low)
export const BEARISH_KEYWORDS: SentimentKeyword[] = [
  // High weight (-3 points)
  { pattern: /paper\s+hands?|📄\s*🙌/gi, weight: 3, label: 'paper hands' },
  { pattern: /\bputs?\b/gi, weight: 3, label: 'puts' },
  { pattern: /\bshort(?!.*squeeze)\b/gi, weight: 3, label: 'short' }, // short but not "short squeeze"
  { pattern: /\bdump(?:ing|ed)?\b/gi, weight: 3, label: 'dump' },
  { pattern: /rug\s+pull/gi, weight: 3, label: 'rug pull' },
  { pattern: /\bcrash(?:ing|ed)?\b/gi, weight: 3, label: 'crash' },

  // Medium weight (-2 points)
  { pattern: /bag\s+holder/gi, weight: 2, label: 'bag holder' },
  { pattern: /\bfud\b/gi, weight: 2, label: 'fud' },
  { pattern: /\bbear(?:ish)?\b/gi, weight: 2, label: 'bear' },
];

/**
 * Analyze sentiment of text for a specific ticker
 */
export function analyzeSentiment(text: string, ticker: string): SentimentResult {
  const lowerText = text.toLowerCase();
  const bullishKeywords: string[] = [];
  const bearishKeywords: string[] = [];

  let bullishScore = 0;
  let bearishScore = 0;

  // Count bullish keywords
  for (const keyword of BULLISH_KEYWORDS) {
    const matches = lowerText.match(keyword.pattern);
    if (matches) {
      bullishKeywords.push(keyword.label);
      bullishScore += keyword.weight * matches.length;
    }
  }

  // Count bearish keywords
  for (const keyword of BEARISH_KEYWORDS) {
    const matches = lowerText.match(keyword.pattern);
    if (matches) {
      bearishKeywords.push(keyword.label);
      bearishScore += keyword.weight * matches.length;
    }
  }

  // Calculate normalized sentiment score (-1 to 1)
  // Use a fixed normalization factor: 10 points = strong sentiment
  const totalScore = bullishScore - bearishScore;
  const NORMALIZATION_FACTOR = 10;
  const normalizedScore = totalScore / NORMALIZATION_FACTOR;

  // Clamp between -1 and 1
  const score = Math.max(-1, Math.min(1, normalizedScore));

  const category = getSentimentCategory(score);

  return {
    score,
    bullishKeywords: [...new Set(bullishKeywords)], // Deduplicate
    bearishKeywords: [...new Set(bearishKeywords)],
    category,
  };
}

/**
 * Get sentiment category based on score
 */
export function getSentimentCategory(score: number): string {
  if (score > 0.6) return 'strong_bullish';
  if (score >= 0.2) return 'bullish';
  if (score >= -0.2) return 'neutral'; // Include -0.2 in neutral
  if (score >= -0.6) return 'bearish'; // Include -0.6 in bearish
  return 'strong_bearish';
}

export type { SentimentKeyword as SentimentKeywordType };
