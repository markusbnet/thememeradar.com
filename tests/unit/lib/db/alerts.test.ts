import { saveAlert, getPendingAlerts, markAlertSent, getRecentAlerts } from '@/lib/db/alerts';

// Mock the DynamoDB client layer
jest.mock('@/lib/db/client', () => ({
  docClient: { send: jest.fn() },
  TABLES: { EMAIL_ALERTS: 'email_alerts' },
  PutCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'Put' })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'Query' })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'Update' })),
  ScanCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'Scan' })),
}));

import { docClient, PutCommand, QueryCommand, UpdateCommand, ScanCommand } from '@/lib/db/client';
const mockSend = docClient.send as jest.Mock;

const baseAlert = {
  ticker: 'GME',
  createdAt: 1700000000000,
  opportunityScore: 85,
  subScores: {
    velocity: 90,
    sentiment: 80,
    socialDominance: 70,
    volumeChange: 85,
    creatorInfluence: 75,
  },
  emailSubject: '🔥 Meme Radar: $GME is showing strong buy signals',
  emailBody: 'Body text here',
  sentAt: null,
};

describe('saveAlert', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a PutCommand to the EMAIL_ALERTS table', async () => {
    mockSend.mockResolvedValueOnce({});
    await saveAlert(baseAlert);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: 'email_alerts' })
    );
  });

  it('includes ttl set to 24 hours after createdAt', async () => {
    mockSend.mockResolvedValueOnce({});
    await saveAlert(baseAlert);
    const putArg = (PutCommand as jest.Mock).mock.calls[0][0];
    const expectedTtl = Math.floor(baseAlert.createdAt / 1000) + 24 * 60 * 60;
    expect(putArg.Item.ttl).toBe(expectedTtl);
  });

  it('passes all alert fields through to the item', async () => {
    mockSend.mockResolvedValueOnce({});
    await saveAlert(baseAlert);
    const putArg = (PutCommand as jest.Mock).mock.calls[0][0];
    expect(putArg.Item.ticker).toBe('GME');
    expect(putArg.Item.opportunityScore).toBe(85);
    expect(putArg.Item.sentAt).toBeNull();
  });
});

describe('getPendingAlerts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns items from the scan result', async () => {
    const items = [{ ...baseAlert, ttl: 1700086400 }];
    mockSend.mockResolvedValueOnce({ Items: items });
    const result = await getPendingAlerts();
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('GME');
  });

  it('returns empty array when no items found', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await getPendingAlerts();
    expect(result).toEqual([]);
  });

  it('returns empty array when Items key is absent', async () => {
    mockSend.mockResolvedValueOnce({});
    const result = await getPendingAlerts();
    expect(result).toEqual([]);
  });

  it('scans with a filter for un-sent alerts', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await getPendingAlerts();
    expect(ScanCommand).toHaveBeenCalledWith(
      expect.objectContaining({ TableName: 'email_alerts', FilterExpression: expect.any(String) })
    );
  });
});

describe('markAlertSent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true on successful update', async () => {
    mockSend.mockResolvedValueOnce({});
    const result = await markAlertSent('GME', 1700000000000);
    expect(result).toBe(true);
  });

  it('sends an UpdateCommand targeting the correct key', async () => {
    mockSend.mockResolvedValueOnce({});
    await markAlertSent('GME', 1700000000000);
    expect(UpdateCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'email_alerts',
        Key: { ticker: 'GME', createdAt: 1700000000000 },
      })
    );
  });

  it('returns false when DynamoDB throws (e.g. item not found)', async () => {
    mockSend.mockRejectedValueOnce(new Error('ConditionalCheckFailedException'));
    const result = await markAlertSent('GME', 1700000000000);
    expect(result).toBe(false);
  });
});

describe('getRecentAlerts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns alerts from query result', async () => {
    const items = [{ ...baseAlert, ttl: 1700086400 }];
    mockSend.mockResolvedValueOnce({ Items: items });
    const result = await getRecentAlerts('GME', 1699900000000);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('GME');
  });

  it('queries the EMAIL_ALERTS table by ticker', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await getRecentAlerts('AAPL', 1699900000000);
    expect(QueryCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'email_alerts',
        ExpressionAttributeValues: expect.objectContaining({ ':ticker': 'AAPL' }),
      })
    );
  });

  it('returns empty array when no items found', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await getRecentAlerts('GME', 1699900000000);
    expect(result).toEqual([]);
  });
});
