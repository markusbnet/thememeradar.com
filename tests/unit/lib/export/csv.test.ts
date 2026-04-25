import {
  escapeCsvField,
  formatCsvRow,
  generateExportCsv,
  EXPORT_HEADERS,
} from '@/lib/export/csv';
import type { ExportRow } from '@/lib/export/csv';

describe('escapeCsvField', () => {
  it('returns plain string unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('returns number as string', () => {
    expect(escapeCsvField(42)).toBe('42');
  });

  it('returns empty string for null', () => {
    expect(escapeCsvField(null)).toBe('');
  });

  it('wraps field in quotes when it contains a comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('doubles internal quotes and wraps in outer quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps field in quotes when it contains a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('returns empty string for empty string input', () => {
    expect(escapeCsvField('')).toBe('');
  });
});

describe('formatCsvRow', () => {
  it('joins plain fields with commas', () => {
    expect(formatCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('handles null fields as empty', () => {
    expect(formatCsvRow(['a', null, 'c'])).toBe('a,,c');
  });

  it('quotes fields with commas', () => {
    expect(formatCsvRow(['a,b', 'c'])).toBe('"a,b",c');
  });

  it('handles numbers', () => {
    expect(formatCsvRow([1, 2.5, null])).toBe('1,2.5,');
  });
});

describe('generateExportCsv', () => {
  it('returns only header row for empty data', () => {
    const csv = generateExportCsv([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(EXPORT_HEADERS.join(','));
  });

  it('header row contains expected columns', () => {
    const csv = generateExportCsv([]);
    expect(csv).toContain('timestamp');
    expect(csv).toContain('mentionCount');
    expect(csv).toContain('sentimentScore');
    expect(csv).toContain('sentimentCategory');
    expect(csv).toContain('price');
    expect(csv).toContain('volume');
  });

  it('generates one data row per ExportRow', () => {
    const rows: ExportRow[] = [
      {
        timestamp: 1700000000000,
        date: '2023-11-14T22:13:20.000Z',
        mentionCount: 100,
        sentimentScore: 0.75,
        sentimentCategory: 'bullish',
        price: 28.45,
        changePct24h: 5.2,
        volume: 9400000,
      },
    ];
    const csv = generateExportCsv(rows);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 data row
  });

  it('data row includes correct values', () => {
    const rows: ExportRow[] = [
      {
        timestamp: 1700000000000,
        date: '2023-11-14T22:13:20.000Z',
        mentionCount: 100,
        sentimentScore: 0.75,
        sentimentCategory: 'bullish',
        price: null,
        changePct24h: null,
        volume: null,
      },
    ];
    const csv = generateExportCsv(rows);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain('1700000000000');
    expect(dataLine).toContain('100');
    expect(dataLine).toContain('0.75');
    expect(dataLine).toContain('bullish');
  });

  it('null price fields appear as empty in csv', () => {
    const rows: ExportRow[] = [
      {
        timestamp: 1700000000000,
        date: '2023-11-14T22:13:20.000Z',
        mentionCount: 50,
        sentimentScore: 0.1,
        sentimentCategory: 'neutral',
        price: null,
        changePct24h: null,
        volume: null,
      },
    ];
    const csv = generateExportCsv(rows);
    const dataLine = csv.split('\n')[1];
    // last 3 fields should be empty (price, changePct24h, volume)
    expect(dataLine.endsWith(',,')).toBe(true);
  });

  it('generates multiple rows in order', () => {
    const rows: ExportRow[] = [
      { timestamp: 1000, date: 'd1', mentionCount: 10, sentimentScore: 0.1, sentimentCategory: 'neutral', price: null, changePct24h: null, volume: null },
      { timestamp: 2000, date: 'd2', mentionCount: 20, sentimentScore: 0.2, sentimentCategory: 'bullish', price: null, changePct24h: null, volume: null },
    ];
    const csv = generateExportCsv(rows);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('1000');
    expect(lines[2]).toContain('2000');
  });
});
