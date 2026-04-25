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
            className="rounded-lg bg-purple-600 min-h-[44px] px-6 py-3 text-white font-semibold hover:bg-purple-700 transition flex items-center justify-center"
          >
            Log In
          </a>
          <a
            href="/signup"
            className="rounded-lg border-2 border-purple-600 min-h-[44px] px-6 py-3 text-purple-600 font-semibold hover:bg-purple-50 transition flex items-center justify-center"
          >
            Sign Up
          </a>
        </div>
      </main>
      <footer className="absolute bottom-4 text-center w-full text-sm text-gray-400">
        <a href="/m" className="hover:text-gray-600">📱 Mobile view</a>
      </footer>
    </div>
  );
}
