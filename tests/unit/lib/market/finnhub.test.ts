/**
 * Finnhub client and price enrichment tests
 */

import { FinnhubClient, classifyStaleness, enrichWithPrices } from '@/lib/market/finnhub';

// Mock DynamoDB price layer
jest.mock('@/lib/db/prices', () => ({
  getLatestPriceMap: jest.fn().mockResolvedValue(new Map()),
  savePrice: jest.fn().mockResolvedValue(undefined),
}));

import { getLatestPriceMap, savePrice } from '@/lib/db/prices';

const mockGetLatestPriceMap = getLatestPriceMap as jest.MockedFunction<typeof getLatestPriceMap>;
const mockSavePrice = savePrice as jest.MockedFunction<typeof savePrice>;

global.fetch = jest.fn();

const MOCK_QUOTE = { c: 150.25, d: 2.5, dp: 1.69, h: 151.0, l: 148.5, o: 149.0, pc: 147.75, t: 1700000000 };

function mockOAuth() { /* Finnhub doesn't need OAuth */ }
function mockQuote(data = MOCK_QUOTE) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => data });
}

describe('classifyStaleness', () => {
  const NOW = Date.now();

  it('returns fresh for age < 15 minutes', () => {
    expect(classifyStaleness(NOW - 5 * 60 * 1000)).toBe('fresh');
  });

  it('returns normal for age 15–60 minutes', () => {
    expect(classifyStaleness(NOW - 30 * 60 * 1000)).toBe('normal');
  });

  it('returns grey for age 1–24 hours', () => {
    expect(classifyStaleness(NOW - 3 * 60 * 60 * 1000)).toBe('grey');
  });

  it('returns drop for age > 24 hours', () => {
    expect(classifyStaleness(NOW - 25 * 60 * 60 * 1000)).toBe('drop');
  });
});

describe('FinnhubClient', () => {
  let client: FinnhubClient;

  beforeEach(() => {
    client = new FinnhubClient('test_api_key');
    jest.clearAllMocks();
  });

  describe('getQuote', () => {
    it('returns mapped StockPriceSnapshot fields', async () => {
      mockQuote();
      const snapshot = await client.getQuote('AAPL');
      expect(snapshot.ticker).toBe('AAPL');
      expect(snapshot.price).toBe(150.25);
      expect(snapshot.changePct24h).toBe(1.69);
      expect(snapshot.dayHigh).toBe(151.0);
      expect(snapshot.dayLow).toBe(148.5);
      expect(snapshot.dayOpen).toBe(149.0);
      expect(snapshot.previousClose).toBe(147.75);
      expect(snapshot.staleness).toBe('fresh');
      expect(snapshot.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('throws on 429 rate limit', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' });
      await expect(client.getQuote('GME')).rejects.toThrow(/rate limit/i);
    });

    it('throws on generic API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });
      await expect(client.getQuote('GME')).rejects.toThrow(/500/);
    });

    it('includes call to correct Finnhub URL', async () => {
      mockQuote();
      await client.getQuote('TSLA');
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/quote');
      expect(url).toContain('symbol=TSLA');
      expect(url).toContain('token=test_api_key');
    });
  });

  describe('getCandles', () => {
    const CANDLE_DATA = {
      c: [150, 151, 152], h: [152, 153, 154], l: [149, 150, 151],
      o: [149, 150, 151], s: 'ok', t: [1700000000, 1700086400, 1700172800], v: [1000000, 1100000, 1200000],
    };

    it('returns candle data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => CANDLE_DATA });
      const candles = await client.getCandles('AAPL', 1700000000, 1700172800);
      expect(candles.s).toBe('ok');
      expect(candles.c).toHaveLength(3);
      expect(candles.v).toHaveLength(3);
    });

    it('throws on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' });
      await expect(client.getCandles('GME', 0, 1)).rejects.toThrow(/403/);
    });
  });
});

describe('enrichWithPrices', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIG_ENV, FINNHUB_API_KEY: 'test_key' };
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  it('skips tickers with fresh price data (< 15 min)', async () => {
    mockGetLatestPriceMap.mockResolvedValueOnce(
      new Map([['GME', { ticker: 'GME', fetchedAt: Date.now() - 5 * 60 * 1000 } as any]])
    );

    await enrichWithPrices(['GME']);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSavePrice).not.toHaveBeenCalled();
  });

  it('fetches and saves price for stale tickers (> 15 min)', async () => {
    mockGetLatestPriceMap.mockResolvedValueOnce(
      new Map([['AAPL', { ticker: 'AAPL', fetchedAt: Date.now() - 20 * 60 * 1000 } as any]])
    );
    mockQuote();

    await enrichWithPrices(['AAPL']);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockSavePrice).toHaveBeenCalledTimes(1);
    expect(mockSavePrice).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'AAPL' }));
  });

  it('fetches price when no existing data', async () => {
    mockGetLatestPriceMap.mockResolvedValueOnce(new Map());
    mockQuote();

    await enrichWithPrices(['TSLA']);

    expect(mockSavePrice).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'TSLA' }));
  });

  it('skips silently when FINNHUB_API_KEY is absent', async () => {
    delete process.env.FINNHUB_API_KEY;

    await enrichWithPrices(['GME']);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSavePrice).not.toHaveBeenCalled();
  });

  it('stops enrichment on 429 rate limit hit', async () => {
    mockGetLatestPriceMap.mockResolvedValueOnce(new Map());
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' });

    await enrichWithPrices(['GME', 'TSLA', 'AAPL']);

    expect(mockSavePrice).not.toHaveBeenCalled();
    // Only one fetch attempt before stopping
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('continues to next ticker on non-rate-limit errors', async () => {
    mockGetLatestPriceMap.mockResolvedValueOnce(new Map());
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => MOCK_QUOTE });

    await enrichWithPrices(['GME', 'TSLA']);

    expect(mockSavePrice).toHaveBeenCalledTimes(1);
    expect(mockSavePrice).toHaveBeenCalledWith(expect.objectContaining({ ticker: 'TSLA' }));
  });
});
