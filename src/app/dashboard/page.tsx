'use client';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-slate-400">
            Welcome to The Meme Radar
          </p>
        </header>

        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Coming Soon
          </h2>
          <p className="text-slate-400">
            Meme stock tracking features will be added here
          </p>
        </div>
      </div>
    </div>
  );
}
