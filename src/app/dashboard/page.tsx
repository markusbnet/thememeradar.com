'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, logout, type User } from '@/lib/auth/client';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = 'Dashboard - The Meme Radar';

    // Check authentication on mount
    const verifyAuth = async () => {
      const { authenticated, user: userData } = await checkAuth();

      if (!authenticated) {
        // Redirect to login if not authenticated
        router.push('/login');
        return;
      }

      setUser(userData || null);
      setIsLoading(false);
    };

    verifyAuth();
  }, [router]);

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      router.push('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-slate-400">
              Welcome back, {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            Log Out
          </button>
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
