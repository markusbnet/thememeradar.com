import { getTrendingStocks } from '@/lib/db/storage';
import { getLatestApewisdomSnapshot } from '@/lib/db/apewisdom';
import { mergeCoverage } from '@/lib/coverage/apewisdom';
import { getLatestPriceMap } from '@/lib/db/prices';
import type { Metadata } from 'next';
import type { StockPriceSnapshot } from '@/types/market';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Meme Radar — Quick View',
};

type MergedStock = Awaited<ReturnType<typeof getTrendingStocks>>[number] & {
  coverageSource?: string;
};

function VelocityBadge({ v }: { v: number }) {
  const sign = v >= 0 ? '+' : '';
  const color = v >= 0 ? '#15803d' : '#b91c1c';
  return <span style={{ color, fontWeight: 600 }}>{sign}{Math.round(v)}%</span>;
}

function PriceCell({ ticker, priceMap }: { ticker: string; priceMap: Map<string, StockPriceSnapshot> }) {
  const p = priceMap.get(ticker);
  if (!p || p.staleness === 'drop') return <span style={{ color: '#9ca3af' }}>—</span>;
  const changeColor = (p.changePct24h ?? 0) >= 0 ? '#15803d' : '#b91c1c';
  const changeSign = (p.changePct24h ?? 0) >= 0 ? '+' : '';
  return (
    <>
      <span>${p.price.toFixed(2)}</span>
      {' '}
      <span style={{ color: changeColor, fontSize: '0.8em' }}>
        {changeSign}{(p.changePct24h ?? 0).toFixed(1)}%
      </span>
    </>
  );
}

export default async function MobilePage() {
  const [rawStocks, awSnapshot] = await Promise.all([
    getTrendingStocks(10, '24h'),
    getLatestApewisdomSnapshot('wallstreetbets'),
  ]);

  const now = Date.now();
  const stocks = mergeCoverage(rawStocks, awSnapshot, now) as MergedStock[];
  const tickers = stocks.map(s => s.ticker);
  const priceMap = await getLatestPriceMap(tickers);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb', color: '#111827', lineHeight: '1.5', padding: '1rem', minHeight: '100vh' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        th { text-align: left; padding: 0.4rem 0.5rem; background: #f3f4f6; font-weight: 600; font-size: 0.75rem; color: #6b7280; text-transform: uppercase; }
        td { padding: 0.5rem; border-bottom: 1px solid #e5e7eb; }
      `}</style>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.25rem' }}>📡 Meme Radar</h1>
      <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>Top trending — last 24h</p>

      <table>
        <thead>
          <tr>
            <th style={{ width: '1.5rem' }}>#</th>
            <th>Ticker</th>
            <th>Velocity</th>
            <th>Price / 24h Δ</th>
          </tr>
        </thead>
        <tbody>
          {stocks.slice(0, 10).map((stock, i) => (
            <tr key={stock.ticker}>
              <td style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{i + 1}</td>
              <td style={{ fontWeight: 700 }}>${stock.ticker}</td>
              <td><VelocityBadge v={stock.velocity} /></td>
              <td><PriceCell ticker={stock.ticker} priceMap={priceMap} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>
        <a href="/dashboard" style={{ color: '#7c3aed', textDecoration: 'none' }}>Full Dashboard</a>
        {' · '}
        Updated {new Date(now).toLocaleTimeString()}
      </p>
    </div>
  );
}
