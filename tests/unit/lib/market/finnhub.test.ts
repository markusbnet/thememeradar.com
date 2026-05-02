/**
 * Finnhub client and price enrichment tests
 */

import { FinnhubClient, classifyStaleness, enrichWithPrices, getCompanyNews, getShortInterest, getInsiderTransactions } from '@/lib/market/finnhub';

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

  describe('getCompanyNews', () => {
    const NEWS_DATA = [
      { id: 1, category: 'company', datetime: 1700000000, headline: 'GME surges', summary: 'Big move', source: 'Reuters', url: 'https://reuters.com/1', image: '', related: 'GME' },
    ];

    it('returns array of news items', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => NEWS_DATA });
      const news = await client.getCompanyNews('GME', '2024-01-01', '2024-01-08');
      expect(news).toHaveLength(1);
      expect(news[0].headline).toBe('GME surges');
    });

    it('calls correct Finnhub URL with symbol and date range', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => NEWS_DATA });
      await client.getCompanyNews('TSLA', '2024-01-01', '2024-01-08');
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/company-news');
      expect(url).toContain('symbol=TSLA');
      expect(url).toContain('from=2024-01-01');
      expect(url).toContain('to=2024-01-08');
    });

    it('returns empty array when API returns non-array', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => null });
      const news = await client.getCompanyNews('GME', '2024-01-01', '2024-01-08');
      expect(news).toEqual([]);
    });

    it('throws on 429 rate limit', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' });
      await expect(client.getCompanyNews('GME', '2024-01-01', '2024-01-08')).rejects.toThrow(/rate limit/i);
    });
  });

  describe('getShortInterest', () => {
    const SHORT_DATA = {
      data: [
        { date: '2024-01-01', long: 10000000, settleDate: '2024-01-03', short: 5000000, shortPercent: 5.23, symbol: 'GME' },
        { date: '2024-01-15', long: 9000000, settleDate: '2024-01-17', short: 6000000, shortPercent: 6.45, symbol: 'GME' },
      ],
      symbol: 'GME',
    };

    it('returns the most recent entry from data array', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => SHORT_DATA });
      const result = await client.getShortInterest('GME', '2024-01-01', '2024-01-31');
      expect(result).not.toBeNull();
      expect(result!.shortPercent).toBe(6.45);
      expect(result!.symbol).toBe('GME');
    });

    it('calls correct Finnhub URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => SHORT_DATA });
      await client.getShortInterest('AMC', '2024-01-01', '2024-01-31');
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/stock/short-interest');
      expect(url).toContain('symbol=AMC');
    });

    it('returns null when data array is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [], symbol: 'GME' }) });
      const result = await client.getShortInterest('GME', '2024-01-01', '2024-01-31');
      expect(result).toBeNull();
    });

    it('returns null when data key is absent', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
      const result = await client.getShortInterest('GME', '2024-01-01', '2024-01-31');
      expect(result).toBeNull();
    });
  });

  describe('getInsiderTransactions (class method)', () => {
    const INSIDER_DATA = {
      data: [
        { name: 'CEO', change: 1000, share: 50000, transactionCode: 'P', transactionDate: '2024-01-10', transactionPrice: 25.0, filingDate: '2024-01-12', isDerivative: false, symbol: 'GME' },
      ],
      symbol: 'GME',
    };

    it('returns the raw data array from API', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => INSIDER_DATA });
      const result = await client.getInsiderTransactions('GME');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('CEO');
    });

    it('calls correct Finnhub URL with symbol', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => INSIDER_DATA });
      await client.getInsiderTransactions('AAPL');
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('/stock/insider-transactions');
      expect(url).toContain('symbol=AAPL');
    });

    it('returns empty array when data key is absent', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
      const result = await client.getInsiderTransactions('GME');
      expect(result).toEqual([]);
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

const MOCK_NEWS = [
  { id: 1, category: 'company', datetime: 1700000000, headline: 'Stock surges', summary: 'Big move', source: 'Reuters', url: 'https://reuters.com/1', image: '', related: 'GME' },
  { id: 2, category: 'company', datetime: 1700001000, headline: 'More news', summary: 'More detail', source: 'Bloomberg', url: 'https://bloomberg.com/1', image: '', related: 'GME' },
];

describe('getCompanyNews', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIG_ENV, FINNHUB_API_KEY: 'test_key' };
  });

  afterEach(() => { process.env = ORIG_ENV; });

  it('returns empty array when API key is absent', async () => {
    delete process.env.FINNHUB_API_KEY;
    const result = await getCompanyNews('GME');
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns up to 5 news items', async () => {
    const sixItems = Array.from({ length: 6 }, (_, i) => ({ ...MOCK_NEWS[0], id: i + 1 }));
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => sixItems });
    const result = await getCompanyNews('GME');
    expect(result).toHaveLength(5);
  });

  it('returns empty array on fetch error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    const result = await getCompanyNews('GME');
    expect(result).toEqual([]);
  });

  it('returns empty array when API returns non-array', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => null });
    const result = await getCompanyNews('GME');
    expect(result).toEqual([]);
  });
});

describe('getShortInterest', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIG_ENV, FINNHUB_API_KEY: 'test_key' };
  });

  afterEach(() => { process.env = ORIG_ENV; });

  it('returns null when API key is absent', async () => {
    delete process.env.FINNHUB_API_KEY;
    const result = await getShortInterest('GME');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns short interest data for a valid ticker', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        data: [{ date: '2024-01-15', long: 9000000, settleDate: '2024-01-17', short: 6000000, shortPercent: 6.45, symbol: 'GME' }],
        symbol: 'GME',
      }),
    });
    const result = await getShortInterest('GME');
    expect(result).not.toBeNull();
    expect(result!.shortPercent).toBe(6.45);
  });

  it('returns null when the ticker has no data', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ data: [], symbol: 'GME' }),
    });
    const result = await getShortInterest('GME');
    expect(result).toBeNull();
  });

  it('returns null on fetch error without throwing', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
    const result = await getShortInterest('GME');
    expect(result).toBeNull();
  });
});

const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const makeTransaction = (overrides: Partial<{
  transactionCode: string;
  isDerivative: boolean;
  transactionDate: string;
}> = {}) => ({
  name: 'Test Insider',
  change: 1000,
  share: 50000,
  transactionCode: 'P',
  transactionDate: recentDate,
  transactionPrice: 25.0,
  filingDate: recentDate,
  isDerivative: false,
  symbol: 'GME',
  ...overrides,
});

describe('getInsiderTransactions', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIG_ENV, FINNHUB_API_KEY: 'test_key' };
  });

  afterEach(() => { process.env = ORIG_ENV; });

  it('returns empty array when API key is absent', async () => {
    delete process.env.FINNHUB_API_KEY;
    const result = await getInsiderTransactions('GME');
    expect(result).toEqual([]);
  });

  it('filters out derivative transactions', async () => {
    const data = { data: [makeTransaction({ isDerivative: true }), makeTransaction()] };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => data });
    const result = await getInsiderTransactions('GME');
    expect(result).toHaveLength(1);
    expect(result[0].isDerivative).toBe(false);
  });

  it('filters out transactions older than 30 days', async () => {
    const data = { data: [makeTransaction({ transactionDate: oldDate }), makeTransaction()] };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => data });
    const result = await getInsiderTransactions('GME');
    expect(result).toHaveLength(1);
    expect(result[0].transactionDate).toBe(recentDate);
  });

  it('filters out non-meaningful transaction codes (F, G, D)', async () => {
    const data = {
      data: [
        makeTransaction({ transactionCode: 'F' }),
        makeTransaction({ transactionCode: 'G' }),
        makeTransaction({ transactionCode: 'D' }),
        makeTransaction({ transactionCode: 'P' }),
        makeTransaction({ transactionCode: 'S' }),
        makeTransaction({ transactionCode: 'A' }),
      ],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => data });
    const result = await getInsiderTransactions('GME');
    expect(result).toHaveLength(3);
    expect(result.map(t => t.transactionCode).sort()).toEqual(['A', 'P', 'S']);
  });

  it('limits result to 10 entries', async () => {
    const data = { data: Array.from({ length: 15 }, () => makeTransaction()) };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => data });
    const result = await getInsiderTransactions('GME');
    expect(result).toHaveLength(10);
  });

  it('returns empty array on fetch error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
    const result = await getInsiderTransactions('GME');
    expect(result).toEqual([]);
  });
});
