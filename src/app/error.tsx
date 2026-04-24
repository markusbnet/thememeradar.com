'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <h1 className="text-4xl font-bold text-red-700 mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="min-h-[44px] px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
