'use client';

import type { Timeframe } from '@/lib/db/storage';

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

const OPTIONS: Timeframe[] = ['1h', '4h', '24h', '7d'];

export default function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <div role="group" aria-label="Select timeframe" className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 gap-1">
      {OPTIONS.map(tf => (
        <button
          key={tf}
          type="button"
          onClick={() => onChange(tf)}
          aria-pressed={value === tf}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors min-h-[44px] ${
            value === tf
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
