/**
 * Surge Alert Component
 * Displays a visually distinct banner for stocks with unusual mention spikes.
 * Renders nothing when no surges are detected.
 */

'use client';

import Link from 'next/link';
import type { SurgeStock } from '@/lib/db/surge';

interface SurgeAlertProps {
  stocks: SurgeStock[];
}

export default function SurgeAlert({ stocks }: SurgeAlertProps) {
  if (!stocks || stocks.length === 0) {
    return null;
  }

  // Show at most 3 stocks
  const displayed = stocks.slice(0, 3);

  return (
    <div className="mb-8 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
        </span>
        <h2 className="text-lg font-semibold text-orange-900">Surge Alert</h2>
        <span className="text-sm text-orange-700">Unusual mention spikes detected</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {displayed.map((stock) => (
          <Link key={stock.ticker} href={`/stock/${stock.ticker}`}>
            <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-orange-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-bold text-gray-900">${stock.ticker}</span>
                <span className="text-lg font-bold text-orange-700">
                  {stock.surgeMultiplier === Infinity ? '...' : `${stock.surgeMultiplier}x`}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  <span className="font-medium text-gray-900">{stock.mentionCount}</span> mentions
                </span>
                <span className={
                  stock.sentimentCategory.includes('bullish')
                    ? 'text-green-700 font-medium'
                    : stock.sentimentCategory.includes('bearish')
                      ? 'text-red-700 font-medium'
                      : 'text-gray-500 font-medium'
                }>
                  {stock.sentimentCategory.replace('_', ' ')}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
