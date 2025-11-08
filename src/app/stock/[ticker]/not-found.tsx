/**
 * Stock Not Found Page
 * Displayed when a stock ticker is not found or has no data
 */

import Link from 'next/link';

export default function StockNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-xl text-gray-600">Stock not found</p>
        <p className="mt-2 text-sm text-gray-500">
          This ticker doesn't have any recent mentions or doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
