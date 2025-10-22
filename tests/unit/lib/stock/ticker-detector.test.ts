import { extractTickers, validateTicker, filterTickers } from '@/lib/stock/ticker-detector';

describe('Ticker Detector', () => {
  describe('extractTickers', () => {
    it('should extract tickers with dollar sign prefix', () => {
      const text = 'I bought $GME and $AMC yesterday';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AMC');
    });

    it('should extract standalone uppercase tickers (2-5 letters)', () => {
      const text = 'TSLA and AAPL are great stocks';
      const tickers = extractTickers(text);

      expect(tickers).toContain('TSLA');
      expect(tickers).toContain('AAPL');
    });

    it('should not extract single letter words', () => {
      const text = 'I bought A stock';
      const tickers = extractTickers(text);

      expect(tickers).not.toContain('I');
      expect(tickers).not.toContain('A');
    });

    it('should not extract words longer than 5 letters', () => {
      const text = 'INVESTMENT and STOCKS are good';
      const tickers = extractTickers(text);

      expect(tickers).not.toContain('INVESTMENT');
      expect(tickers).not.toContain('STOCKS');
    });

    it('should extract tickers from text with emojis', () => {
      const text = '$GME to the moon 🚀🚀🚀 and $AMC 💎🙌';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AMC');
    });

    it('should handle multiple occurrences of same ticker', () => {
      const text = '$GME is great. Buy $GME now. $GME 🚀';
      const tickers = extractTickers(text);

      // Should deduplicate
      const uniqueTickers = [...new Set(tickers)];
      expect(uniqueTickers).toContain('GME');
      expect(uniqueTickers.filter(t => t === 'GME')).toHaveLength(1);
    });

    it('should extract tickers in mixed case (but return uppercase)', () => {
      const text = 'I like $gme and $Amc';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AMC');
    });

    it('should handle tickers with periods (like BRK.B)', () => {
      const text = 'BRK.B and BRK.A are Berkshire stocks';
      const tickers = extractTickers(text);

      // For now, we'll extract the base ticker
      expect(tickers).toContain('BRK');
    });

    it('should extract from complex Reddit post', () => {
      const text = `
        YOLO on $GME calls 🚀🚀🚀
        DD: GME is severely undervalued. Compare to AMC.
        My positions: 100 shares GME, 50 shares TSLA
        Not financial advice!
      `;
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AMC');
      expect(tickers).toContain('TSLA');
    });

    it('should not extract tickers from URLs', () => {
      const text = 'Check out HTTP://EXAMPLE.COM for DD on $GME';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).not.toContain('HTTP');
      expect(tickers).not.toContain('EXAMPLE');
      expect(tickers).not.toContain('COM');
    });

    it('should return empty array for text with no tickers', () => {
      const text = 'This is just normal text with no stock tickers';
      const tickers = extractTickers(text);

      expect(tickers).toEqual([]);
    });
  });

  describe('validateTicker', () => {
    it('should return true for valid tickers in the list', () => {
      expect(validateTicker('AAPL')).toBe(true);
      expect(validateTicker('TSLA')).toBe(true);
      expect(validateTicker('GME')).toBe(true);
    });

    it('should return false for tickers not in the list', () => {
      expect(validateTicker('FAKE')).toBe(false);
      expect(validateTicker('NOTREAL')).toBe(false);
    });

    it('should return false for blacklisted words', () => {
      expect(validateTicker('FOR')).toBe(false);
      expect(validateTicker('IT')).toBe(false);
      expect(validateTicker('CEO')).toBe(false);
      expect(validateTicker('DD')).toBe(false); // DD is blacklisted (Due Diligence)
    });

    it('should be case-insensitive', () => {
      expect(validateTicker('aapl')).toBe(true);
      expect(validateTicker('Aapl')).toBe(true);
      expect(validateTicker('AAPL')).toBe(true);
    });

    it('should handle undefined/null/empty gracefully', () => {
      expect(validateTicker('')).toBe(false);
      expect(validateTicker(null as any)).toBe(false);
      expect(validateTicker(undefined as any)).toBe(false);
    });
  });

  describe('filterTickers', () => {
    it('should filter out invalid tickers', () => {
      const tickers = ['AAPL', 'FAKE', 'TSLA', 'NOTREAL', 'GME'];
      const filtered = filterTickers(tickers);

      expect(filtered).toContain('AAPL');
      expect(filtered).toContain('TSLA');
      expect(filtered).toContain('GME');
      expect(filtered).not.toContain('FAKE');
      expect(filtered).not.toContain('NOTREAL');
    });

    it('should filter out blacklisted words', () => {
      const tickers = ['AAPL', 'FOR', 'TSLA', 'IT', 'CEO'];
      const filtered = filterTickers(tickers);

      expect(filtered).toContain('AAPL');
      expect(filtered).toContain('TSLA');
      expect(filtered).not.toContain('FOR');
      expect(filtered).not.toContain('IT');
      expect(filtered).not.toContain('CEO');
    });

    it('should deduplicate tickers', () => {
      const tickers = ['AAPL', 'AAPL', 'TSLA', 'AAPL', 'TSLA'];
      const filtered = filterTickers(tickers);

      expect(filtered).toEqual(['AAPL', 'TSLA']);
    });

    it('should normalize to uppercase', () => {
      const tickers = ['aapl', 'Tsla', 'GME'];
      const filtered = filterTickers(tickers);

      expect(filtered).toContain('AAPL');
      expect(filtered).toContain('TSLA');
      expect(filtered).toContain('GME');
    });

    it('should return empty array for no valid tickers', () => {
      const tickers = ['FAKE', 'NOTREAL', 'FOR', 'IT'];
      const filtered = filterTickers(tickers);

      expect(filtered).toEqual([]);
    });

    it('should handle empty input', () => {
      const filtered = filterTickers([]);
      expect(filtered).toEqual([]);
    });
  });

  describe('Integration: Extract and Filter', () => {
    it('should extract and filter in one flow', () => {
      const text = `
        YOLO on $GME and FOR some reason IT went up!
        Also bought AAPL, TSLA, and FAKE ticker.
        CEO of the company announced NOTREAL partnership.
      `;

      const extracted = extractTickers(text);
      const filtered = filterTickers(extracted);

      // Should have valid tickers
      expect(filtered).toContain('GME');
      expect(filtered).toContain('AAPL');
      expect(filtered).toContain('TSLA');

      // Should not have blacklisted words
      expect(filtered).not.toContain('FOR');
      expect(filtered).not.toContain('IT');
      expect(filtered).not.toContain('CEO');
      expect(filtered).not.toContain('YOLO'); // Not a ticker

      // Should not have invalid tickers
      expect(filtered).not.toContain('FAKE');
      expect(filtered).not.toContain('NOTREAL');
    });

    it('should handle real wallstreetbets post', () => {
      const text = `
        🚀🚀🚀 $GME DD - Why I'm going all in 💎🙌

        TLDR: GME squeeze incoming. Shorts have NOT covered.

        My positions:
        - 1000 shares GME @ $45
        - 50 calls $GME 60C 3/19

        Compare GME to AMC - both have strong sentiment on WSB.
        Also watching TSLA and AAPL for potential plays.

        This is NOT financial advice. YOLO at your own risk!

        CEO Ryan Cohen is a legend. SEC can't stop this.
      `;

      const extracted = extractTickers(text);
      const filtered = filterTickers(extracted);

      // Valid tickers
      expect(filtered).toContain('GME');
      expect(filtered).toContain('AMC');
      expect(filtered).toContain('TSLA');
      expect(filtered).toContain('AAPL');

      // Not tickers or blacklisted
      expect(filtered).not.toContain('DD');
      expect(filtered).not.toContain('TLDR');
      expect(filtered).not.toContain('CEO');
      expect(filtered).not.toContain('SEC');
      expect(filtered).not.toContain('WSB');
      expect(filtered).not.toContain('YOLO');
      expect(filtered).not.toContain('NOT');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text efficiently', () => {
      const longText = 'GME '.repeat(1000) + 'AAPL '.repeat(1000);
      const extracted = extractTickers(longText);
      const filtered = filterTickers(extracted);

      expect(filtered).toContain('GME');
      expect(filtered).toContain('AAPL');
      expect(filtered.length).toBe(2); // Deduped
    });

    it('should handle special characters around tickers', () => {
      const text = '$GME! $AAPL? ($TSLA) [$AMC] <$NVDA>';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AAPL');
      expect(tickers).toContain('TSLA');
      expect(tickers).toContain('AMC');
      expect(tickers).toContain('NVDA');
    });

    it('should handle tickers at start/end of text', () => {
      const text = 'GME is great and so is AAPL';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AAPL');
    });

    it('should handle text with only dollar signs', () => {
      const text = '$$$$$';
      const tickers = extractTickers(text);

      expect(tickers).toEqual([]);
    });

    it('should handle mixed valid and invalid patterns', () => {
      const text = '$A $AB $ABC $ABCD $ABCDE $ABCDEF';
      const tickers = extractTickers(text);
      const filtered = filterTickers(tickers);

      // Only 2-5 letter tickers should be extracted
      expect(tickers).not.toContain('A'); // 1 letter
      expect(tickers).toContain('AB');
      expect(tickers).toContain('ABC');
      expect(tickers).toContain('ABCD');
      expect(tickers).toContain('ABCDE');
      expect(tickers).not.toContain('ABCDEF'); // 6 letters
    });
  });
});
