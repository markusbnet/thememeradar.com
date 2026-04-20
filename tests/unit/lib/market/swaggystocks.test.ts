/**
 * Unit tests for SwaggyStocks options data reader.
 * DynamoDB is fully mocked — no live DB required.
 */

jest.mock('@/lib/db/client', () => ({
  docClient: { send: jest.fn() },
  TABLES: { STOCK_OPTIONS: 'stock_options' },
  QueryCommand: jest.fn().mockImplementation((input) => input),
}));

import { getLatestOptionsActivity, getOptionsMap } from '@/lib/market/swaggystocks';
import { docClient } from '@/lib/db/client';

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

const SAMPLE_ACTIVITY = {
  ticker: 'GME',
  timestamp: 1713600000000,
  callOpenInterest: 450000,
  putOpenInterest: 180000,
  putCallRatio: 0.40,
  iv30d: 0.85,
  fetchedAt: 1713600000000,
  ttl: 1716278400,
};

describe('getLatestOptionsActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no data in table (empty Items)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await getLatestOptionsActivity('GME');
    expect(result).toBeNull();
  });

  it('returns null when Items is undefined', async () => {
    mockSend.mockResolvedValueOnce({});
    const result = await getLatestOptionsActivity('GME');
    expect(result).toBeNull();
  });

  it('returns OptionsActivity when data exists', async () => {
    mockSend.mockResolvedValueOnce({ Items: [SAMPLE_ACTIVITY] });
    const result = await getLatestOptionsActivity('GME');
    expect(result).not.toBeNull();
  });

  it('returns correct ticker field', async () => {
    mockSend.mockResolvedValueOnce({ Items: [SAMPLE_ACTIVITY] });
    const result = await getLatestOptionsActivity('GME');
    expect(result?.ticker).toBe('GME');
  });

  it('returns correct callOpenInterest', async () => {
    mockSend.mockResolvedValueOnce({ Items: [SAMPLE_ACTIVITY] });
    const result = await getLatestOptionsActivity('GME');
    expect(result?.callOpenInterest).toBe(450000);
  });

  it('returns correct putOpenInterest', async () => {
    mockSend.mockResolvedValueOnce({ Items: [SAMPLE_ACTIVITY] });
    const result = await getLatestOptionsActivity('GME');
    expect(result?.putOpenInterest).toBe(180000);
  });

  it('returns correct putCallRatio', async () => {
    mockSend.mockResolvedValueOnce({ Items: [SAMPLE_ACTIVITY] });
    const result = await getLatestOptionsActivity('GME');
    expect(result?.putCallRatio).toBe(0.40);
  });

  it('returns correct iv30d when not null', async () => {
    mockSend.mockResolvedValueOnce({ Items: [SAMPLE_ACTIVITY] });
    const result = await getLatestOptionsActivity('GME');
    expect(result?.iv30d).toBe(0.85);
  });

  it('returns iv30d as null when null in DB', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ ...SAMPLE_ACTIVITY, iv30d: null }] });
    const result = await getLatestOptionsActivity('BIRD');
    expect(result?.iv30d).toBeNull();
  });

  it('queries the STOCK_OPTIONS table with ScanIndexForward=false and Limit=1', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await getLatestOptionsActivity('GME');
    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArg = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.ScanIndexForward).toBe(false);
    expect(callArg.Limit).toBe(1);
  });
});

describe('getOptionsMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty map when all tickers have no data', async () => {
    mockSend.mockResolvedValue({ Items: [] });
    const result = await getOptionsMap(['GME', 'AMC']);
    expect(result.size).toBe(0);
  });

  it('returns map with entry when data exists for ticker', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [SAMPLE_ACTIVITY] })
      .mockResolvedValueOnce({ Items: [] });
    const result = await getOptionsMap(['GME', 'AMC']);
    expect(result.size).toBe(1);
    expect(result.has('GME')).toBe(true);
  });

  it('returns map with all tickers that have data', async () => {
    const amcActivity = { ...SAMPLE_ACTIVITY, ticker: 'AMC', putCallRatio: 1.50 };
    mockSend
      .mockResolvedValueOnce({ Items: [SAMPLE_ACTIVITY] })
      .mockResolvedValueOnce({ Items: [amcActivity] });
    const result = await getOptionsMap(['GME', 'AMC']);
    expect(result.size).toBe(2);
    expect(result.has('GME')).toBe(true);
    expect(result.has('AMC')).toBe(true);
  });
});
