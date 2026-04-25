export interface ExportRow {
  timestamp: number;
  date: string;
  mentionCount: number;
  sentimentScore: number;
  sentimentCategory: string;
  price: number | null;
  changePct24h: number | null;
  volume: number | null;
}

export const EXPORT_HEADERS = [
  'timestamp',
  'date',
  'mentionCount',
  'sentimentScore',
  'sentimentCategory',
  'price',
  'changePct24h',
  'volume',
] as const;

export function escapeCsvField(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function formatCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

export function generateExportCsv(rows: ExportRow[]): string {
  const header = EXPORT_HEADERS.join(',');
  const lines = rows.map(r =>
    formatCsvRow([
      r.timestamp,
      r.date,
      r.mentionCount,
      r.sentimentScore,
      r.sentimentCategory,
      r.price,
      r.changePct24h,
      r.volume,
    ])
  );
  return [header, ...lines].join('\n');
}
