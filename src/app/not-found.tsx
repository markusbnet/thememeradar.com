import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Page Not Found</h2>
        <p className="text-gray-600 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="min-h-[44px] px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="min-h-[44px] px-4 py-2 border-2 border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md transition"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
