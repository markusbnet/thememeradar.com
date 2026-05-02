import { checkAndCreateAlerts } from '@/lib/alert-pipeline';

jest.mock('@/lib/db/storage', () => ({
  getTrendingStocks: jest.fn(),
}));

jest.mock('@/lib/db/enrichment', () => ({
  getLatestEnrichment: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/opportunity-score', () => ({
  computeOpportunityScore: jest.fn(),
}));

jest.mock('@/lib/db/alerts', () => ({
  getRecentAlerts: jest.fn().mockResolvedValue([]),
  saveAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/email-alert', () => ({
  generateAlertSubject: jest.fn().mockReturnValue('Subject'),
  generateAlertBody: jest.fn().mockReturnValue('Body'),
  shouldSendAlert: jest.fn().mockReturnValue(true),
}));

import { getTrendingStocks } from '@/lib/db/storage';
import { computeOpportunityScore } from '@/lib/opportunity-score';
import { saveAlert, getRecentAlerts } from '@/lib/db/alerts';
import { shouldSendAlert } from '@/lib/email-alert';

const mockGetTrending = getTrendingStocks as jest.Mock;
const mockComputeOpportunity = computeOpportunityScore as jest.Mock;
const mockSaveAlert = saveAlert as jest.Mock;
const mockShouldSendAlert = shouldSendAlert as jest.Mock;
const mockGetRecentAlerts = getRecentAlerts as jest.Mock;

const hotOpportunity = {
  ticker: 'GME',
  score: 90,
  signalLevel: 'hot' as const,
  subScores: { velocity: 90, sentiment: 80, socialDominance: 70, volumeChange: 85, creatorInfluence: 75 },
};

const risingOpportunity = {
  ticker: 'AMC',
  score: 65,
  signalLevel: 'rising' as const,
  subScores: { velocity: 60, sentiment: 55, socialDominance: 50, volumeChange: 60, creatorInfluence: 45 },
};

const trendingGME = {
  ticker: 'GME',
  mentionCount: 500,
  sentimentScore: 0.8,
  sentimentCategory: 'bullish',
  velocity: 200,
  timestamp: Date.now(),
};

describe('checkAndCreateAlerts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns immediately when tickers array is empty', async () => {
    await checkAndCreateAlerts([]);
    expect(mockGetTrending).not.toHaveBeenCalled();
  });

  it('fetches top 50 trending stocks', async () => {
    mockGetTrending.mockResolvedValueOnce([]);
    await checkAndCreateAlerts(['GME']);
    expect(mockGetTrending).toHaveBeenCalledWith(50);
  });

  it('only processes tickers that appear in trending stocks', async () => {
    mockGetTrending.mockResolvedValueOnce([trendingGME]);
    mockComputeOpportunity.mockReturnValue(hotOpportunity);

    await checkAndCreateAlerts(['GME', 'TSLA']); // TSLA is not in trending

    expect(mockComputeOpportunity).toHaveBeenCalledTimes(1);
    expect(mockComputeOpportunity).toHaveBeenCalledWith(trendingGME, null);
  });

  it('saves alert when signal is hot and no duplicate exists', async () => {
    mockGetTrending.mockResolvedValueOnce([trendingGME]);
    mockComputeOpportunity.mockReturnValue(hotOpportunity);
    mockShouldSendAlert.mockReturnValueOnce(true);

    await checkAndCreateAlerts(['GME']);

    expect(mockSaveAlert).toHaveBeenCalledTimes(1);
    expect(mockSaveAlert).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'GME', opportunityScore: 90 })
    );
  });

  it('does not save alert when signal level is not hot', async () => {
    mockGetTrending.mockResolvedValueOnce([{ ...trendingGME, ticker: 'AMC' }]);
    mockComputeOpportunity.mockReturnValue(risingOpportunity);

    await checkAndCreateAlerts(['AMC']);

    expect(mockSaveAlert).not.toHaveBeenCalled();
  });

  it('suppresses alert when shouldSendAlert returns false (duplicate within window)', async () => {
    mockGetTrending.mockResolvedValueOnce([trendingGME]);
    mockComputeOpportunity.mockReturnValue(hotOpportunity);
    mockShouldSendAlert.mockReturnValueOnce(false);

    await checkAndCreateAlerts(['GME']);

    expect(mockSaveAlert).not.toHaveBeenCalled();
  });

  it('calls getRecentAlerts to check for duplicates', async () => {
    mockGetTrending.mockResolvedValueOnce([trendingGME]);
    mockComputeOpportunity.mockReturnValue(hotOpportunity);

    await checkAndCreateAlerts(['GME']);

    expect(mockGetRecentAlerts).toHaveBeenCalledWith('GME', expect.any(Number));
  });

  it('saves alert with null sentAt', async () => {
    mockGetTrending.mockResolvedValueOnce([trendingGME]);
    mockComputeOpportunity.mockReturnValue(hotOpportunity);

    await checkAndCreateAlerts(['GME']);

    expect(mockSaveAlert).toHaveBeenCalledWith(
      expect.objectContaining({ sentAt: null })
    );
  });

  it('processes multiple hot stocks in a single call', async () => {
    const trendingAMC = { ...trendingGME, ticker: 'AMC' };
    mockGetTrending.mockResolvedValueOnce([trendingGME, trendingAMC]);
    mockComputeOpportunity.mockReturnValue(hotOpportunity);

    await checkAndCreateAlerts(['GME', 'AMC']);

    expect(mockSaveAlert).toHaveBeenCalledTimes(2);
  });

  it('does not create alert when no trending stocks match tickers list', async () => {
    mockGetTrending.mockResolvedValueOnce([{ ...trendingGME, ticker: 'TSLA' }]);

    await checkAndCreateAlerts(['GME', 'AMC']);

    expect(mockComputeOpportunity).not.toHaveBeenCalled();
    expect(mockSaveAlert).not.toHaveBeenCalled();
  });
});
