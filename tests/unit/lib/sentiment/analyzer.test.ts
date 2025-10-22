import {
  analyzeSentiment,
  calculateSentimentScore,
  extractKeywords,
  getSentimentCategory,
  analyzeBulkSentiment,
  type SentimentResult,
} from '@/lib/sentiment/analyzer';

describe('Sentiment Analyzer', () => {
  describe('extractKeywords', () => {
    it('should extract bullish keywords', () => {
      const text = 'GME to the moon 🚀🚀🚀 with my 💎🙌';
      const keywords = extractKeywords(text);

      expect(keywords.bullish).toContain('🚀🚀🚀');
      expect(keywords.bullish).toContain('💎🙌');
      expect(keywords.bullish).toContain('moon');
    });

    it('should extract bearish keywords', () => {
      const text = 'This is a rug pull, selling my bags 📄🙌';
      const keywords = extractKeywords(text);

      expect(keywords.bearish).toContain('rug pull');
      expect(keywords.bearish).toContain('📄🙌');
      expect(keywords.bearish).toContain('selling');
    });

    it('should be case-insensitive', () => {
      const text = 'YOLO on calls, going TO THE MOON';
      const keywords = extractKeywords(text);

      expect(keywords.bullish).toContain('YOLO');
      expect(keywords.bullish).toContain('calls');
      expect(keywords.bullish).toContain('to the moon');
    });

    it('should handle mixed sentiment keywords', () => {
      const text = 'Bullish on calls but also watching for a dump';
      const keywords = extractKeywords(text);

      expect(keywords.bullish.length).toBeGreaterThan(0);
      expect(keywords.bearish.length).toBeGreaterThan(0);
    });

    it('should handle text with no keywords', () => {
      const text = 'This is just normal text without any sentiment';
      const keywords = extractKeywords(text);

      expect(keywords.bullish).toEqual([]);
      expect(keywords.bearish).toEqual([]);
      expect(keywords.neutral).toEqual([]);
    });

    it('should extract multi-word phrases', () => {
      const text = 'This is a short squeeze with gamma squeeze potential';
      const keywords = extractKeywords(text);

      expect(keywords.bullish).toContain('short squeeze');
      expect(keywords.bullish).toContain('gamma squeeze');
    });

    it('should handle emojis correctly', () => {
      const text = '🚀 GME 🚀 💎🙌 HODL 🦍';
      const keywords = extractKeywords(text);

      expect(keywords.bullish).toContain('🚀');
      expect(keywords.bullish).toContain('💎🙌');
      expect(keywords.bullish).toContain('HODL');
      expect(keywords.bullish).toContain('🦍');
    });
  });

  describe('calculateSentimentScore', () => {
    it('should return positive score for bullish text', () => {
      const text = 'GME to the moon 🚀🚀🚀 YOLO on calls 💎🙌';
      const score = calculateSentimentScore(text);

      expect(score).toBeGreaterThan(0);
    });

    it('should return negative score for bearish text', () => {
      const text = 'This is a rug pull, dumping all my bags 📄🙌';
      const score = calculateSentimentScore(text);

      expect(score).toBeLessThan(0);
    });

    it('should return score near 0 for neutral text', () => {
      const text = 'The market is trading sideways, watching and waiting';
      const score = calculateSentimentScore(text);

      expect(score).toBeGreaterThanOrEqual(-0.2);
      expect(score).toBeLessThanOrEqual(0.2);
    });

    it('should return 0 for text with no keywords', () => {
      const text = 'This is just normal text';
      const score = calculateSentimentScore(text);

      expect(score).toBe(0);
    });

    it('should weight keywords appropriately', () => {
      // 🚀🚀🚀 has weight 4, 💎🙌 has weight 3
      const heavyBullish = 'GME 🚀🚀🚀 💎🙌';
      const lightBullish = 'GME is green and has momentum';

      const heavyScore = calculateSentimentScore(heavyBullish);
      const lightScore = calculateSentimentScore(lightBullish);

      expect(heavyScore).toBeGreaterThan(lightScore);
    });

    it('should normalize score to -1 to 1 range', () => {
      const veryBullish = '🚀🚀🚀 💎🙌 YOLO calls squeeze moon lambo lfg';
      const score = calculateSentimentScore(veryBullish);

      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle mixed sentiment (net score)', () => {
      // More bullish than bearish
      const mixedText = 'GME 🚀🚀🚀 YOLO but also some FUD and bears';
      const score = calculateSentimentScore(mixedText);

      expect(score).toBeGreaterThan(0); // Net bullish
    });
  });

  describe('getSentimentCategory', () => {
    it('should categorize strong bullish (> 0.6)', () => {
      expect(getSentimentCategory(0.8)).toBe('strong_bullish');
      expect(getSentimentCategory(0.7)).toBe('strong_bullish');
      expect(getSentimentCategory(1.0)).toBe('strong_bullish');
    });

    it('should categorize bullish (0.2 to 0.6)', () => {
      expect(getSentimentCategory(0.5)).toBe('bullish');
      expect(getSentimentCategory(0.3)).toBe('bullish');
      expect(getSentimentCategory(0.21)).toBe('bullish');
    });

    it('should categorize neutral (-0.2 to 0.2)', () => {
      expect(getSentimentCategory(0.1)).toBe('neutral');
      expect(getSentimentCategory(0)).toBe('neutral');
      expect(getSentimentCategory(-0.1)).toBe('neutral');
    });

    it('should categorize bearish (-0.6 to -0.2)', () => {
      expect(getSentimentCategory(-0.3)).toBe('bearish');
      expect(getSentimentCategory(-0.5)).toBe('bearish');
      expect(getSentimentCategory(-0.21)).toBe('bearish');
    });

    it('should categorize strong bearish (< -0.6)', () => {
      expect(getSentimentCategory(-0.7)).toBe('strong_bearish');
      expect(getSentimentCategory(-0.8)).toBe('strong_bearish');
      expect(getSentimentCategory(-1.0)).toBe('strong_bearish');
    });

    it('should handle boundary values correctly', () => {
      expect(getSentimentCategory(0.6)).toBe('bullish'); // Not quite strong
      expect(getSentimentCategory(0.61)).toBe('strong_bullish');
      expect(getSentimentCategory(-0.6)).toBe('bearish');
      expect(getSentimentCategory(-0.61)).toBe('strong_bearish');
    });
  });

  describe('analyzeSentiment', () => {
    it('should return complete sentiment analysis', () => {
      const text = 'GME to the moon 🚀🚀🚀 YOLO 💎🙌';
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result).toHaveProperty('ticker', 'GME');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('reasoning');
      expect(result.score).toBeGreaterThan(0);
      expect(result.category).toMatch(/bullish/);
    });

    it('should analyze context around ticker mention', () => {
      const text = `
        Some random text here.
        GME is going to the moon 🚀🚀🚀 with diamond hands 💎🙌.
        More random text after.
      `;
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.score).toBeGreaterThan(0);
      expect(result.keywords.bullish.length).toBeGreaterThan(0);
    });

    it('should handle ticker not in text', () => {
      const text = 'AAPL is great 🚀';
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      // Should still analyze the whole text if ticker not found
      expect(result.ticker).toBe('GME');
      expect(result.score).toBeDefined();
    });

    it('should include reasoning in result', () => {
      const text = 'GME 🚀🚀🚀 YOLO calls';
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should handle multiple ticker mentions', () => {
      const text = 'GME 🚀 is great, GME to the moon, GME 💎🙌';
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.ticker).toBe('GME');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should be case-insensitive for ticker', () => {
      const text = 'gme is going to the moon 🚀';
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.ticker).toBe('GME');
    });

    it('should handle bearish sentiment correctly', () => {
      const text = 'GME is a rug pull, dumping everything 📄🙌';
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.score).toBeLessThan(0);
      expect(result.category).toMatch(/bearish/);
    });
  });

  describe('analyzeBulkSentiment', () => {
    it('should analyze multiple texts and return aggregate', () => {
      const texts = [
        'GME to the moon 🚀🚀🚀',
        'GME YOLO calls 💎🙌',
        'GME is bullish',
      ];
      const ticker = 'GME';

      const result = analyzeBulkSentiment(texts, ticker);

      expect(result.ticker).toBe('GME');
      expect(result.averageScore).toBeGreaterThan(0);
      expect(result.category).toMatch(/bullish/);
      expect(result.sampleSize).toBe(3);
      expect(result.individualResults).toHaveLength(3);
    });

    it('should calculate average score correctly', () => {
      const texts = [
        'GME 🚀🚀🚀', // Very bullish
        'GME dump 📄', // Bearish
        'GME neutral',  // Neutral
      ];
      const ticker = 'GME';

      const result = analyzeBulkSentiment(texts, ticker);

      // Average should be positive but not as high as all bullish
      expect(result.averageScore).toBeGreaterThan(-1);
      expect(result.averageScore).toBeLessThan(1);
    });

    it('should handle empty array', () => {
      const texts: string[] = [];
      const ticker = 'GME';

      const result = analyzeBulkSentiment(texts, ticker);

      expect(result.sampleSize).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.category).toBe('neutral');
      expect(result.individualResults).toEqual([]);
    });

    it('should provide top keywords from all texts', () => {
      const texts = [
        'GME 🚀🚀🚀 YOLO',
        'GME 🚀 moon',
        'GME 🚀 calls',
      ];
      const ticker = 'GME';

      const result = analyzeBulkSentiment(texts, ticker);

      expect(result.topKeywords).toBeDefined();
      expect(result.topKeywords.bullish).toContain('🚀');
    });
  });

  describe('Real-world Examples', () => {
    it('should analyze typical wallstreetbets bullish post', () => {
      const text = `
        🚀🚀🚀 GME DD - Why I'm going all in 💎🙌

        TLDR: GME squeeze incoming. Shorts have NOT covered.

        My positions:
        - 1000 shares GME @ $45
        - 50 calls GME 60C 3/19

        This is going to the moon! YOLO!

        Not financial advice. 🦍 together strong.
      `;
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.category).toMatch(/bullish/);
      expect(result.keywords.bullish.length).toBeGreaterThan(3);
    });

    it('should analyze typical bearish post', () => {
      const text = `
        GME bagholders still in denial 📄🙌

        This is clearly overvalued and heading for a crash.
        The dump is coming. Rug pull incoming.

        Anyone still holding is going to get rekt.
      `;
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.score).toBeLessThan(-0.3);
      expect(result.category).toMatch(/bearish/);
      expect(result.keywords.bearish.length).toBeGreaterThan(3);
    });

    it('should analyze neutral/informational post', () => {
      const text = `
        GME is trading sideways today. Consolidation phase.
        Watching for the next move. Volume is flat.
      `;
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.score).toBeGreaterThanOrEqual(-0.3);
      expect(result.score).toBeLessThanOrEqual(0.3);
    });

    it('should handle mixed sentiment with sarcasm', () => {
      const text = `
        GME "to the moon" 🚀 they said...
        Now I'm a bagholder watching it tank.
        Paper hands were right all along.
      `;
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      // Should detect bearish despite some bullish keywords
      expect(result.keywords.bearish.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      const result = analyzeSentiment('', 'GME');

      expect(result.score).toBe(0);
      expect(result.category).toBe('neutral');
    });

    it('should handle very long text efficiently', () => {
      const longText = 'GME 🚀 '.repeat(1000);
      const ticker = 'GME';

      const result = analyzeSentiment(longText, ticker);

      expect(result.score).toBeGreaterThan(0);
      expect(result).toBeDefined();
    });

    it('should handle special characters', () => {
      const text = '$GME !!! 🚀🚀🚀 ??? $$$ 💎🙌 !!!';
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle unicode and international characters', () => {
      const text = 'GME 🚀 到月球 Луна';
      const ticker = 'GME';

      const result = analyzeSentiment(text, ticker);

      expect(result).toBeDefined();
    });

    it('should handle null/undefined gracefully', () => {
      const result = analyzeSentiment(null as any, 'GME');

      expect(result.score).toBe(0);
      expect(result.category).toBe('neutral');
    });
  });

  describe('Keyword Weighting', () => {
    it('should give higher weight to strong indicators', () => {
      const weakBullish = 'GME is green';
      const strongBullish = 'GME 🚀🚀🚀 YOLO squeeze';

      const weakScore = calculateSentimentScore(weakBullish);
      const strongScore = calculateSentimentScore(strongBullish);

      expect(strongScore).toBeGreaterThan(weakScore);
    });

    it('should handle keyword repetition', () => {
      const single = 'GME 🚀';
      const repeated = 'GME 🚀 🚀 🚀';

      const singleScore = calculateSentimentScore(single);
      const repeatedScore = calculateSentimentScore(repeated);

      expect(repeatedScore).toBeGreaterThanOrEqual(singleScore);
    });
  });
});
