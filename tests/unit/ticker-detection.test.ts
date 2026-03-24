/**
 * Stock Ticker Detection Tests
 */

import { extractTickers, isValidTicker } from '@/lib/ticker-detection';

describe('Ticker Detection', () => {
  describe('isValidTicker', () => {
    it('should accept valid NYSE/NASDAQ tickers', () => {
      expect(isValidTicker('GME')).toBe(true);
      expect(isValidTicker('AAPL')).toBe(true);
      expect(isValidTicker('TSLA')).toBe(true);
      expect(isValidTicker('AMC')).toBe(true);
      expect(isValidTicker('BB')).toBe(true);
      expect(isValidTicker('NVDA')).toBe(true);
    });

    it('should reject unknown uppercase words', () => {
      expect(isValidTicker('YOLO')).toBe(false);
      expect(isValidTicker('MOON')).toBe(false);
      expect(isValidTicker('HOLD')).toBe(false);
      expect(isValidTicker('LETS')).toBe(false);
      expect(isValidTicker('ZZZZ')).toBe(false);
    });

    it('should reject common words that look like tickers', () => {
      expect(isValidTicker('FOR')).toBe(false);
      expect(isValidTicker('IT')).toBe(false);
      expect(isValidTicker('ARE')).toBe(false);
      expect(isValidTicker('OR')).toBe(false);
      expect(isValidTicker('ON')).toBe(false);
      expect(isValidTicker('BY')).toBe(false);
      expect(isValidTicker('AT')).toBe(false);
      expect(isValidTicker('TO')).toBe(false);
      expect(isValidTicker('IN')).toBe(false);
    });

    it('should reject single-letter tickers', () => {
      expect(isValidTicker('A')).toBe(false);
      expect(isValidTicker('I')).toBe(false);
    });

    it('should reject tickers longer than 5 letters', () => {
      expect(isValidTicker('TOOLONG')).toBe(false);
      expect(isValidTicker('ABCDEF')).toBe(false);
    });

    it('should reject lowercase or mixed case', () => {
      expect(isValidTicker('gme')).toBe(false);
      expect(isValidTicker('Gme')).toBe(false);
      expect(isValidTicker('GME')).toBe(true);
    });
  });

  describe('extractTickers', () => {
    it('should extract $SYMBOL format', () => {
      const text = 'I bought $GME and $AMC yesterday!';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AMC');
      expect(tickers).toHaveLength(2);
    });

    it('should extract standalone uppercase symbols', () => {
      const text = 'TSLA is going to the moon! AAPL too!';
      const tickers = extractTickers(text);

      expect(tickers).toContain('TSLA');
      expect(tickers).toContain('AAPL');
      expect(tickers).toHaveLength(2);
    });

    it('should extract both $SYMBOL and standalone formats', () => {
      const text = '$GME and AAPL are my favorites!';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AAPL');
      expect(tickers).toHaveLength(2);
    });

    it('should deduplicate tickers', () => {
      const text = '$GME is great! GME to the moon! Buy $GME now!';
      const tickers = extractTickers(text);

      expect(tickers).toEqual(['GME']);
    });

    it('should filter out common words', () => {
      const text = 'I think $GME is FOR sale AT a discount OR maybe not';
      const tickers = extractTickers(text);

      // Should only extract GME, not FOR, AT, OR
      expect(tickers).toEqual(['GME']);
    });

    it('should filter out single-letter symbols without $', () => {
      const text = 'I think AAPL is A good investment';
      const tickers = extractTickers(text);

      // Should extract AAPL but not A
      expect(tickers).toEqual(['AAPL']);
    });

    it('should accept single-letter symbols with $', () => {
      const text = 'I bought $F (Ford) stock';
      const tickers = extractTickers(text);

      // Should extract F when prefixed with $
      expect(tickers).toEqual(['F']);
    });

    it('should handle empty text', () => {
      expect(extractTickers('')).toEqual([]);
    });

    it('should handle text with no tickers', () => {
      const text = 'This is a normal sentence with no stock symbols';
      expect(extractTickers(text)).toEqual([]);
    });

    it('should extract from wallstreetbets-style text', () => {
      const text = '🚀🚀 $GME to the moon! 💎🙌 HODL TSLA and AMC! Diamond hands baby!';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('TSLA');
      expect(tickers).toContain('AMC');
      expect(tickers).toHaveLength(3);
    });

    it('should handle tickers in URLs correctly', () => {
      const text = 'Check out https://finance.yahoo.com/quote/GME for $GME info';
      const tickers = extractTickers(text);

      // Should extract GME from both URL and $GME
      expect(tickers).toEqual(['GME']);
    });

    it('should extract from lists and formatted text', () => {
      const text = `
        My portfolio:
        - $GME (GameStop)
        - TSLA (Tesla)
        - AMC Entertainment
        - NVDA
      `;
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('TSLA');
      expect(tickers).toContain('AMC');
      expect(tickers).toContain('NVDA');
      expect(tickers).toHaveLength(4);
    });

    it('should handle mixed case correctly', () => {
      const text = 'I love $gme and Tsla but GME is better';
      const tickers = extractTickers(text);

      // Should only extract properly formatted GME (all caps)
      expect(tickers).toEqual(['GME']);
    });

    it('should reject random uppercase words that are not real tickers', () => {
      const text = 'YOLO MOON HOLD SELL LETS MAKE SOME GAINS TODAY';
      const tickers = extractTickers(text);

      // None of these are real NYSE/NASDAQ tickers
      expect(tickers).toEqual([]);
    });

    it('should accept well-known NYSE/NASDAQ tickers', () => {
      const text = 'My portfolio has AAPL MSFT GOOGL AMZN TSLA NVDA META';
      const tickers = extractTickers(text);

      expect(tickers).toContain('AAPL');
      expect(tickers).toContain('MSFT');
      expect(tickers).toContain('GOOGL');
      expect(tickers).toContain('AMZN');
      expect(tickers).toContain('TSLA');
      expect(tickers).toContain('NVDA');
      expect(tickers).toContain('META');
      expect(tickers).toHaveLength(7);
    });

    it('should accept popular meme stocks', () => {
      const text = '$GME $AMC $BB $BBBY $PLTR $SOFI';
      const tickers = extractTickers(text);

      expect(tickers).toContain('GME');
      expect(tickers).toContain('AMC');
      expect(tickers).toContain('BB');
      expect(tickers).toContain('BBBY');
      expect(tickers).toContain('PLTR');
      expect(tickers).toContain('SOFI');
    });

    it('should accept popular ETFs', () => {
      const text = 'SPY QQQ IWM DIA VTI VOO';
      const tickers = extractTickers(text);

      expect(tickers).toContain('SPY');
      expect(tickers).toContain('QQQ');
      expect(tickers).toContain('IWM');
      expect(tickers).toContain('DIA');
      expect(tickers).toContain('VTI');
      expect(tickers).toContain('VOO');
    });

    it('should reject words that look like tickers but are not listed', () => {
      const text = 'DONT MISS THIS HUGE DEAL';
      const tickers = extractTickers(text);

      // None of these are real NYSE/NASDAQ tickers
      expect(tickers).toEqual([]);
    });

    it('should accept ambiguous tickers when prefixed with $', () => {
      const text = '$IT $ON $FAST are my picks';
      const tickers = extractTickers(text);

      // These are real tickers and have $ prefix
      expect(tickers).toContain('IT');
      expect(tickers).toContain('ON');
      expect(tickers).toContain('FAST');
    });

    it('should reject ambiguous tickers without $ prefix', () => {
      const text = 'IT is going ON and things look FAST';
      const tickers = extractTickers(text);

      // These are common words — need $ prefix
      expect(tickers).toEqual([]);
    });
  });
});
