import { enrichWithApewisdom } from '@/lib/market/apewisdom';

jest.mock('@/lib/db/apewisdom', () => ({
  saveApewisdomSnapshot: jest.fn().mockResolvedValue(undefined),
}));

import { saveApewisdomSnapshot } from '@/lib/db/apewisdom';
const mockSave = saveApewisdomSnapshot as jest.MockedFunction<typeof saveApewisdomSnapshot>;

global.fetch = jest.fn();

const MOCK_RESPONSE = {
  count: 3,
  pages: 1,
  current_page: 1,
  results: [
    { rank: 1, ticker: 'GME', name: 'GameStop', mentions: 500, upvotes: 2000, rank_24h_ago: 3, mentions_24h_ago: 300 },
    { rank: 2, ticker: 'amc', name: 'AMC', mentions: 400, upvotes: 1500, rank_24h_ago: null, mentions_24h_ago: 0 },
    { rank: 3, ticker: 'PLTR', name: 'Palantir', mentions: 200, upvotes: 800, rank_24h_ago: 5, mentions_24h_ago: 150 },
  ],
};

describe('enrichWithApewisdom', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches and saves a snapshot with uppercased tickers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_RESPONSE,
    });

    await enrichWithApewisdom();

    expect(mockSave).toHaveBeenCalledTimes(1);
    const snapshot = mockSave.mock.calls[0][0];
    expect(snapshot.subreddit).toBe('all-stocks');
    expect(snapshot.rows).toHaveLength(3);
    expect(snapshot.rows[0].ticker).toBe('GME');
    expect(snapshot.rows[1].ticker).toBe('AMC'); // uppercased
    expect(snapshot.rows[2].ticker).toBe('PLTR');
  });

  it('sets ttl 48 hours ahead', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => MOCK_RESPONSE,
    });

    const before = Math.floor(Date.now() / 1000);
    await enrichWithApewisdom();
    const after = Math.floor(Date.now() / 1000);

    const { ttl } = mockSave.mock.calls[0][0];
    const expected48h = 48 * 60 * 60;
    expect(ttl).toBeGreaterThanOrEqual(before + expected48h);
    expect(ttl).toBeLessThanOrEqual(after + expected48h + 1);
  });

  it('handles null rank_24h_ago gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => MOCK_RESPONSE,
    });

    await enrichWithApewisdom();

    const { rows } = mockSave.mock.calls[0][0];
    expect(rows[1].rank_24h_ago).toBeNull();
    expect(rows[1].mentions_24h_ago).toBe(0);
  });

  it('does not save when fetch returns non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 });

    await enrichWithApewisdom();

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does not save when results array is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ ...MOCK_RESPONSE, results: [] }),
    });

    await enrichWithApewisdom();

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does not throw when fetch rejects', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network timeout'));

    await expect(enrichWithApewisdom()).resolves.not.toThrow();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('calls the correct ApeWisdom all-stocks endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => MOCK_RESPONSE,
    });

    await enrichWithApewisdom();

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('apewisdom.io');
    expect(calledUrl).toContain('filter/all-stocks');
  });
});
