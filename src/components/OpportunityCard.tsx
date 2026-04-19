'use client';

import Link from 'next/link';
import type { OpportunityScore } from '@/lib/opportunity-score';

interface OpportunityCardProps {
  opportunity: OpportunityScore;
  rank: number;
}

const SIGNAL_CONFIG = {
  hot: {
    emoji: '🔥',
    label: 'Hot Opportunity',
    cardClasses: 'border-orange-200 bg-orange-50',
    badgeClasses: 'bg-orange-100 text-orange-800',
    scoreClasses: 'text-orange-700',
  },
  rising: {
    emoji: '⚡',
    label: 'Rising Signal',
    cardClasses: 'border-yellow-200 bg-yellow-50',
    badgeClasses: 'bg-yellow-100 text-yellow-800',
    scoreClasses: 'text-yellow-700',
  },
  watch: {
    emoji: '👀',
    label: 'Watch',
    cardClasses: 'border-blue-200 bg-blue-50',
    badgeClasses: 'bg-blue-100 text-blue-800',
    scoreClasses: 'text-blue-700',
  },
  none: {
    emoji: '',
    label: '',
    cardClasses: 'border-gray-200 bg-white',
    badgeClasses: 'bg-gray-100 text-gray-700',
    scoreClasses: 'text-gray-700',
  },
};

function SubScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-purple-500 h-1.5 rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-7 text-right">{Math.round(value)}</span>
    </div>
  );
}

export default function OpportunityCard({ opportunity, rank }: OpportunityCardProps) {
  const { ticker, score, signalLevel, subScores } = opportunity;
  const config = SIGNAL_CONFIG[signalLevel] ?? SIGNAL_CONFIG.none;

  return (
    <Link href={`/stock/${ticker}`}>
      <div className={`rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border-2 cursor-pointer ${config.cardClasses}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-500">#{rank}</span>
              <h3 className="text-xl font-bold text-gray-900">${ticker}</h3>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badgeClasses}`}>
              {config.emoji} {config.label}
            </span>
          </div>

          {/* Score badge */}
          <div className="text-center">
            <div className={`text-3xl font-bold ${config.scoreClasses}`}>{score}</div>
            <div className="text-xs text-gray-400 mt-0.5">/ 100</div>
          </div>
        </div>

        {/* Sub-score bars */}
        <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-200/70">
          <SubScoreBar label="Velocity" value={subScores.velocity} />
          <SubScoreBar label="Sentiment" value={subScores.sentiment} />
          <SubScoreBar label="Social" value={subScores.socialDominance} />
          <SubScoreBar label="Volume" value={subScores.volumeChange} />
          <SubScoreBar label="Creator" value={subScores.creatorInfluence} />
        </div>

        <div className="mt-3 text-xs text-purple-600 font-medium text-center">
          View details →
        </div>
      </div>
    </Link>
  );
}
