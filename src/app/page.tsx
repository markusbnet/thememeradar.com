export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-3xl sm:text-5xl font-bold">📡 The Meme Radar</h1>
        <p className="text-lg sm:text-xl text-gray-600">
          Track meme stock trends from Reddit in real-time
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <a
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition"
          >
            Log In
          </a>
          <a
            href="/signup"
            className="rounded-lg border-2 border-blue-600 px-6 py-3 text-blue-600 font-semibold hover:bg-blue-50 transition"
          >
            Sign Up
          </a>
        </div>
      </main>
    </div>
  );
}
