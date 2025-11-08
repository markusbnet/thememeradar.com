/**
 * Evidence Section Component
 * Displays posts and comments that mention the stock
 */

import React from 'react';

interface Evidence {
  ticker: string;
  evidenceId: string;
  type: 'post' | 'comment';
  text: string;
  keywords: string[];
  sentimentScore: number;
  sentimentCategory: string;
  upvotes: number;
  subreddit: string;
  createdAt: number;
  redditUrl?: string;
}

interface EvidenceSectionProps {
  evidence: Evidence[];
}

function highlightKeywords(text: string, keywords: string[]): React.ReactElement[] {
  if (keywords.length === 0) {
    return [<span key="text">{text}</span>];
  }

  // Create regex pattern for all keywords (case-insensitive)
  const pattern = new RegExp(
    `(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );

  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isKeyword = keywords.some(
      k => k.toLowerCase() === part.toLowerCase()
    );

    if (isKeyword) {
      return (
        <mark
          key={index}
          className="bg-yellow-200 px-1 font-semibold text-gray-900"
        >
          {part}
        </mark>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

function getSentimentBadgeColor(category: string): string {
  const colorMap: Record<string, string> = {
    strong_bullish: 'bg-green-100 text-green-800',
    bullish: 'bg-green-50 text-green-700',
    neutral: 'bg-gray-100 text-gray-800',
    bearish: 'bg-red-50 text-red-700',
    strong_bearish: 'bg-red-100 text-red-800',
  };
  return colorMap[category] || 'bg-gray-100 text-gray-800';
}

export default function EvidenceSection({ evidence }: EvidenceSectionProps) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">Supporting Evidence</h2>
        <p className="mt-4 text-sm text-gray-500">
          No evidence available for this stock yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-gray-900">Supporting Evidence</h2>
      <p className="mt-1 text-sm text-gray-500">
        Top posts and comments by upvotes
      </p>

      <div className="mt-6 space-y-6">
        {evidence.map((item) => (
          <div
            key={item.evidenceId}
            className="border-l-4 border-gray-200 pl-4 hover:border-blue-500"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-gray-900">
                {item.type === 'post' ? '📝 Post' : '💬 Comment'}
              </span>
              <span className="text-gray-500">in r/{item.subreddit}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-500">↑ {item.upvotes}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${getSentimentBadgeColor(
                  item.sentimentCategory
                )}`}
              >
                {item.sentimentCategory.replace('_', ' ')}
              </span>
            </div>

            {/* Text with highlighted keywords */}
            <div className="mt-2 text-sm text-gray-700">
              {highlightKeywords(item.text, item.keywords)}
            </div>

            {/* Footer */}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              {item.keywords.length > 0 && (
                <span>Keywords: {item.keywords.join(', ')}</span>
              )}
              {item.redditUrl && (
                <a
                  href={item.redditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  View on Reddit →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
