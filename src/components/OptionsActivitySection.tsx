'use client';

import CollapsibleSection from '@/components/CollapsibleSection';

interface OptionsActivityData {
  callOpenInterest: number;
  putOpenInterest: number;
  putCallRatio: number;
  iv30d: number | null;
}

interface Props {
  options: OptionsActivityData | null | undefined;
}

export default function OptionsActivitySection({ options }: Props) {
  if (!options) return null;

  return (
    <CollapsibleSection title="Options Activity">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Put/Call Ratio</p>
          <p className={`text-xl font-bold ${options.putCallRatio > 1 ? 'text-red-700' : 'text-green-700'}`}>
            {options.putCallRatio.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">
            {options.putCallRatio > 1 ? 'Bearish lean' : 'Bullish lean'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Call OI</p>
          <p className="text-xl font-bold text-green-700">
            {(options.callOpenInterest / 1000).toFixed(0)}K
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Put OI</p>
          <p className="text-xl font-bold text-red-700">
            {(options.putOpenInterest / 1000).toFixed(0)}K
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">30-Day IV</p>
          <p className="text-xl font-bold text-gray-900">
            {options.iv30d !== null ? `${(options.iv30d * 100).toFixed(0)}%` : 'N/A'}
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
