'use client';

import Link from 'next/link';

export default function StockDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <h1 className="text-4xl font-bold text-red-700 mb-4">Stock Data Error</h1>
        <p className="text-gray-600 mb-6">
          Failed to load stock details. Please try again.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="min-h-[44px] px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="min-h-[44px] px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
