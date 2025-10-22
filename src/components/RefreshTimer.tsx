/**
 * Refresh Timer Component
 * Displays when data was last updated and auto-refreshes the page
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

export default function RefreshTimer() {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>('just now');
  const [nextUpdate, setNextUpdate] = useState<string>('5 minutes');

  useEffect(() => {
    // Update time ago every second
    const timer = setInterval(() => {
      const now = new Date();
      const diffMs = now.getTime() - lastUpdated.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);

      if (diffMin < 1) {
        setTimeAgo(`${diffSec} seconds ago`);
      } else if (diffMin === 1) {
        setTimeAgo('1 minute ago');
      } else {
        setTimeAgo(`${diffMin} minutes ago`);
      }

      // Calculate next update
      const remainingMs = REFRESH_INTERVAL - diffMs;
      const remainingSec = Math.floor(remainingMs / 1000);
      const remainingMin = Math.floor(remainingSec / 60);

      if (remainingMin < 1) {
        setNextUpdate(`${remainingSec} seconds`);
      } else if (remainingMin === 1) {
        setNextUpdate('1 minute');
      } else {
        setNextUpdate(`${remainingMin} minutes`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastUpdated]);

  useEffect(() => {
    // Auto-refresh every 5 minutes
    const refreshTimer = setInterval(() => {
      setLastUpdated(new Date());
      router.refresh();
    }, REFRESH_INTERVAL);

    return () => clearInterval(refreshTimer);
  }, [router]);

  const handleManualRefresh = () => {
    setLastUpdated(new Date());
    router.refresh();
  };

  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-xs text-gray-500">Last updated</p>
        <p className="text-sm font-medium text-gray-700">{timeAgo}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">Next update in</p>
        <p className="text-sm font-medium text-purple-600">{nextUpdate}</p>
      </div>
      <button
        onClick={handleManualRefresh}
        className="ml-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
