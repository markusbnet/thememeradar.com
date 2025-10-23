/**
 * Sentiment Analysis Tests
 */

import {
  analyzeSentiment,
  getSentimentCategory,
  type SentimentResult,
} from '@/lib/sentiment';

describe('Sentiment Analysis', () => {
  describe('analyzeSentiment', () => {
    it('should detect bullish keywords', () => {
      const text = '💎🙌 Diamond hands! $GME to the moon 🚀🚀🚀';
      const result = analyzeSentiment(text, 'GME');

      expect(result.score).toBeGreaterThan(0);
      expect(result.bullishKeywords).toContain('diamond hands');
      expect(result.bullishKeywords).toContain('to the moon');
      expect(result.bearishKeywords).toHaveLength(0);
    });

    it('should detect bearish keywords', () => {
      const text = 'Paper hands selling $GME. Rug pull incoming. FUD everywhere.';
      const result = analyzeSentiment(text, 'GME');

      expect(result.score).toBeLessThan(0);
      expect(result.bearishKeywords).toContain('paper hands');
      expect(result.bearishKeywords).toContain('rug pull');
      expect(result.bearishKeywords).toContain('fud');
      expect(result.bullishKeywords).toHaveLength(0);
    });

    it('should handle mixed sentiment', () => {
      const text = '$GME looks bullish but there is some FUD';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bullishKeywords.length).toBeGreaterThan(0);
      expect(result.bearishKeywords.length).toBeGreaterThan(0);
      // Score should be slightly positive since "bullish" is weighted higher than "FUD"
      expect(result.score).toBeGreaterThan(-0.5);
    });

    it('should return neutral for no keywords', () => {
      const text = '$GME is a stock that exists';
      const result = analyzeSentiment(text, 'GME');

      expect(result.score).toBe(0);
      expect(result.bullishKeywords).toHaveLength(0);
      expect(result.bearishKeywords).toHaveLength(0);
    });

    it('should weight high-impact keywords more heavily', () => {
      const strongBullish = '🚀 $GME short squeeze incoming!';
      const weakBullish = '$GME stonks';

      const strong = analyzeSentiment(strongBullish, 'GME');
      const weak = analyzeSentiment(weakBullish, 'GME');

      expect(strong.score).toBeGreaterThan(weak.score);
    });

    it('should detect YOLO', () => {
      const text = 'YOLO $GME calls!';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bullishKeywords).toContain('yolo');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect HODL', () => {
      const text = 'HODL $GME forever!';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bullishKeywords).toContain('hodl');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect calls (bullish)', () => {
      const text = 'Buying $GME calls';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bullishKeywords).toContain('calls');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect puts (bearish)', () => {
      const text = 'Buying $GME puts';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bearishKeywords).toContain('puts');
      expect(result.score).toBeLessThan(0);
    });

    it('should detect tendies', () => {
      const text = '🍗 Making tendies on $GME!';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bullishKeywords).toContain('tendies');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect ape/apes', () => {
      const text = '🦍 Apes together strong on $GME';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bullishKeywords).toContain('apes');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect bag holder (bearish)', () => {
      const text = '$GME bag holders getting wrecked';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bearishKeywords).toContain('bag holder');
      expect(result.score).toBeLessThan(0);
    });

    it('should detect dump (bearish)', () => {
      const text = '$GME dump incoming';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bearishKeywords).toContain('dump');
      expect(result.score).toBeLessThan(0);
    });

    it('should be case-insensitive', () => {
      const text = 'DIAMOND HANDS on $gme!';
      const result = analyzeSentiment(text, 'GME');

      expect(result.bullishKeywords).toContain('diamond hands');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should detect multiple instances of same keyword', () => {
      const text = '🚀🚀🚀 $GME to the moon! Moon time baby! 🚀';
      const result = analyzeSentiment(text, 'GME');

      // Should count multiple instances
      expect(result.score).toBeGreaterThan(0);
    });

    it('should normalize score between -1 and 1', () => {
      const veryBullish = '🚀💎🙌 YOLO $GME calls! Short squeeze! Gamma squeeze! To the moon! Diamond hands! HODL! Tendies!';
      const result = analyzeSentiment(veryBullish, 'GME');

      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.score).toBeGreaterThanOrEqual(-1);
    });
  });

  describe('getSentimentCategory', () => {
    it('should categorize strong bullish (> 0.6)', () => {
      expect(getSentimentCategory(0.8)).toBe('strong_bullish');
      expect(getSentimentCategory(0.7)).toBe('strong_bullish');
      expect(getSentimentCategory(0.61)).toBe('strong_bullish');
    });

    it('should categorize bullish (0.2 to 0.6)', () => {
      expect(getSentimentCategory(0.5)).toBe('bullish');
      expect(getSentimentCategory(0.3)).toBe('bullish');
      expect(getSentimentCategory(0.2)).toBe('bullish');
    });

    it('should categorize neutral (-0.2 to 0.2)', () => {
      expect(getSentimentCategory(0.1)).toBe('neutral');
      expect(getSentimentCategory(0)).toBe('neutral');
      expect(getSentimentCategory(-0.1)).toBe('neutral');
      expect(getSentimentCategory(-0.2)).toBe('neutral');
    });

    it('should categorize bearish (-0.6 to -0.2)', () => {
      expect(getSentimentCategory(-0.3)).toBe('bearish');
      expect(getSentimentCategory(-0.5)).toBe('bearish');
      expect(getSentimentCategory(-0.21)).toBe('bearish');
    });

    it('should categorize strong bearish (< -0.6)', () => {
      expect(getSentimentCategory(-0.7)).toBe('strong_bearish');
      expect(getSentimentCategory(-0.8)).toBe('strong_bearish');
      expect(getSentimentCategory(-0.61)).toBe('strong_bearish');
    });

    it('should handle boundary values', () => {
      expect(getSentimentCategory(0.6)).toBe('bullish'); // Just under strong_bullish
      expect(getSentimentCategory(0.61)).toBe('strong_bullish');
      expect(getSentimentCategory(-0.6)).toBe('bearish'); // Just above strong_bearish
      expect(getSentimentCategory(-0.61)).toBe('strong_bearish');
    });
  });
});
