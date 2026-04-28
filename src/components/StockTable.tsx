'use client';

import Link from 'next/link';
import { useState } from 'react';
import Sparkline from './Sparkline';

type SortKey = 'rank' | 'ticker' | 'mentions' | 'velocity' | 'sentiment' | 'price';
type SortDir = 'asc' | 'desc';

interface StockTableStock {
  ticker: string;
  mentionCount: number;
  mentionsPrev?: number;
  mentionDelta?: number;
  sentimentScore: number;
  sentimentCategory: string;
  velocity: number;
  timestamp: number;
  sparklineData?: number[];
  rankDelta24h?: number | null;
  rankStatus?: string;
  price?: number;
  changePct24h?: number;
  staleness?: 'fresh' | 'normal' | 'grey' | 'drop';
  coverageSource?: 'reddit' | 'apewisdom' | 'both';
}

interface StockTableProps {
  stocks: StockTableStock[];
  type: 'trending' | 'fading';
}

function RankDeltaBadge({ delta, status }: { delta: number | null | undefined; status?: string }) {
  if (status === 'new') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
        NEW
      </span>
    );
  }
  if (status === 'unknown' || delta == null) {
    return <span className="text-gray-500">—</span>;
  }
  if (delta === 0) return <span className="text-gray-500 text-xs">—</span>;
  return (
    <span className={`text-xs font-medium ${delta > 0 ? 'text-green-700' : 'text-red-700'}`}>
      {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
    </span>
  );
}

function SentimentCell({ category }: { category: string }) {
  const map: Record<string, { label: string; color: string }> = {
    strong_bullish: { label: 'Strong Bull', color: 'text-green-700' },
    bullish:        { label: 'Bullish',     color: 'text-green-700' },
    neutral:        { label: 'Neutral',     color: 'text-gray-500' },
    bearish:        { label: 'Bearish',     color: 'text-red-700'   },
    strong_bearish: { label: 'Strong Bear', color: 'text-red-700'   },
  };
  const s = map[category] ?? { label: category, color: 'text-gray-500' };
  return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function PriceCell({
  price,
  changePct24h,
  staleness,
}: {
  price?: number;
  changePct24h?: number;
  staleness?: string;
}) {
  if (price == null || staleness === 'drop') {
    return <span className="text-gray-500">—</span>;
  }
  const isGrey = staleness === 'grey';
  const changeColor = isGrey
    ? 'text-gray-500'
    : (changePct24h ?? 0) >= 0
      ? 'text-green-700'
      : 'text-red-700';
  return (
    <div>
      <div className={`font-medium ${isGrey ? 'text-gray-500' : 'text-gray-900'}`}>
        ${price.toFixed(2)}
      </div>
      {changePct24h != null && (
        <div className={`text-xs ${changeColor}`}>
          {changePct24h >= 0 ? '+' : ''}{changePct24h.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null;
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function StockTable({ stocks, type }: StockTableProps) {
  const defaultDir: SortDir = 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const sorted = [...stocks].sort((a, b) => {
    const originalA = stocks.indexOf(a);
    const originalB = stocks.indexOf(b);

    let diff = 0;
    switch (sortKey) {
      case 'rank':      diff = originalA - originalB; break;
      case 'ticker':    diff = a.ticker.localeCompare(b.ticker); break;
      case 'mentions':  diff = a.mentionCount - b.mentionCount; break;
      case 'velocity':  diff = a.velocity - b.velocity; break;
      case 'sentiment': diff = a.sentimentScore - b.sentimentScore; break;
      case 'price':     diff = (a.price ?? -Infinity) - (b.price ?? -Infinity); break;
    }

    return sortDir === 'asc' ? diff : -diff;
  });

  if (stocks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No stocks found. Waiting for first scan to complete...</p>
      </div>
    );
  }

  const thBase =
    'px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap bg-gray-50';
  const thSortable = `${thBase} cursor-pointer hover:bg-gray-100 select-none`;
  const ariaSort = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <div className="overflow-x-auto rounded-lg shadow ring-1 ring-gray-200">
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-200">
            {/* Sticky ticker + rank column */}
            <th
              scope="col"
              className={`${thSortable} sticky left-0 z-10 min-w-[130px]`}
              onClick={() => handleSort('ticker')}
              onKeyDown={e => e.key === 'Enter' && handleSort('ticker')}
              tabIndex={0}
              aria-sort={ariaSort('ticker')}
            >
              # Ticker
              <SortIndicator active={sortKey === 'ticker'} dir={sortDir} />
            </th>

            <th scope="col" className={thBase}>
              Δ24h
            </th>

            <th
              scope="col"
              className={`${thSortable} text-right`}
              onClick={() => handleSort('mentions')}
              onKeyDown={e => e.key === 'Enter' && handleSort('mentions')}
              tabIndex={0}
              aria-sort={ariaSort('mentions')}
            >
              Mentions
              <SortIndicator active={sortKey === 'mentions'} dir={sortDir} />
            </th>

            <th
              scope="col"
              className={`${thSortable} text-right`}
              onClick={() => handleSort('velocity')}
              onKeyDown={e => e.key === 'Enter' && handleSort('velocity')}
              tabIndex={0}
              aria-sort={ariaSort('velocity')}
            >
              Velocity
              <SortIndicator active={sortKey === 'velocity'} dir={sortDir} />
            </th>

            <th
              scope="col"
              className={thSortable}
              onClick={() => handleSort('sentiment')}
              onKeyDown={e => e.key === 'Enter' && handleSort('sentiment')}
              tabIndex={0}
              aria-sort={ariaSort('sentiment')}
            >
              Sentiment
              <SortIndicator active={sortKey === 'sentiment'} dir={sortDir} />
            </th>

            <th
              scope="col"
              className={`${thSortable} text-right`}
              onClick={() => handleSort('price')}
              onKeyDown={e => e.key === 'Enter' && handleSort('price')}
              tabIndex={0}
              aria-sort={ariaSort('price')}
            >
              Price
              <SortIndicator active={sortKey === 'price'} dir={sortDir} />
            </th>

            <th scope="col" className={thBase}>
              7d
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((stock, visIndex) => {
            const originalRank = stocks.indexOf(stock) + 1;
            const rowBg = visIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/60';
            return (
              <tr
                key={stock.ticker}
                className={`${rowBg} border-b border-gray-100 hover:bg-purple-50/30 transition-colors`}
              >
                {/* Sticky rank + ticker */}
                <td className={`sticky left-0 z-10 ${rowBg} px-3 py-2.5 whitespace-nowrap`}>
                  <Link href={`/stock/${stock.ticker}`} className="flex items-center gap-2 group">
                    <span className="text-xs text-gray-500 w-4 shrink-0 tabular-nums">
                      {originalRank}
                    </span>
                    <span className="font-bold text-purple-700 group-hover:text-purple-900 transition-colors">
                      ${stock.ticker}
                    </span>
                    {stock.coverageSource === 'apewisdom' && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 leading-none">AW</span>
                    )}
                    {stock.coverageSource === 'both' && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-green-50 text-green-700 leading-none">AW+</span>
                    )}
                  </Link>
                </td>

                {/* Rank delta */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <RankDeltaBadge delta={stock.rankDelta24h} status={stock.rankStatus} />
                </td>

                {/* Mentions */}
                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                  <span className="font-medium text-gray-900">
                    {stock.mentionCount.toLocaleString()}
                  </span>
                  {stock.mentionDelta != null && stock.mentionDelta !== 0 && (
                    <span
                      className={`ml-1 text-xs ${stock.mentionDelta > 0 ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {stock.mentionDelta > 0 ? '+' : ''}{stock.mentionDelta}
                    </span>
                  )}
                </td>

                {/* Velocity */}
                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                  <span
                    className={`font-medium ${
                      stock.velocity > 0
                        ? 'text-green-700'
                        : stock.velocity < 0
                          ? 'text-red-700'
                          : 'text-gray-500'
                    }`}
                  >
                    {stock.velocity > 0 ? '+' : ''}
                    {stock.velocity.toFixed(0)}%
                  </span>
                </td>

                {/* Sentiment */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <SentimentCell category={stock.sentimentCategory} />
                </td>

                {/* Price */}
                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                  <PriceCell
                    price={stock.price}
                    changePct24h={stock.changePct24h}
                    staleness={stock.staleness}
                  />
                </td>

                {/* Sparkline */}
                <td className="px-3 py-2.5 w-20">
                  {stock.sparklineData && stock.sparklineData.length > 1 ? (
                    <Sparkline data={stock.sparklineData} />
                  ) : (
                    <span className="text-gray-500 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
