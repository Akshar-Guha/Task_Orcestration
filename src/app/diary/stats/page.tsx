'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  streak: { current: number; longest: number; total: number };
  weekly: { avgMood: number; avgEnergy: number; totalDeepWork: number; entriesCount: number };
  monthly: { avgMood: number; avgEnergy: number; totalDeepWork: number; entriesCount: number };
}

export default function DiaryStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/diary/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/diary" className="text-white/60 hover:text-white transition">
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-white">📊 Statistics</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Streak */}
        <div className="bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/50 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">🔥 Journaling Streak</h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-300">{stats?.streak.current || 0}</div>
              <div className="text-white/60 text-sm mt-1">Current</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-300">{stats?.streak.longest || 0}</div>
              <div className="text-white/60 text-sm mt-1">Longest</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-300">{stats?.streak.total || 0}</div>
              <div className="text-white/60 text-sm mt-1">Total Entries</div>
            </div>
          </div>
        </div>

        {/* Weekly Stats */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">📅 This Week</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Avg Mood</div>
              <div className="text-2xl font-bold text-green-400">
                {stats?.weekly.avgMood?.toFixed(1) || 'N/A'}/5
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Avg Energy</div>
              <div className="text-2xl font-bold text-blue-400">
                {stats?.weekly.avgEnergy?.toFixed(1) || 'N/A'}/10
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Deep Work</div>
              <div className="text-2xl font-bold text-purple-400">
                {stats?.weekly.totalDeepWork || 0}m
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Entries</div>
              <div className="text-2xl font-bold text-white">
                {stats?.weekly.entriesCount || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">📆 This Month</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Avg Mood</div>
              <div className="text-2xl font-bold text-green-400">
                {stats?.monthly.avgMood?.toFixed(1) || 'N/A'}/5
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Avg Energy</div>
              <div className="text-2xl font-bold text-blue-400">
                {stats?.monthly.avgEnergy?.toFixed(1) || 'N/A'}/10
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Deep Work</div>
              <div className="text-2xl font-bold text-purple-400">
                {stats?.monthly.totalDeepWork || 0}m
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-1">Entries</div>
              <div className="text-2xl font-bold text-white">
                {stats?.monthly.entriesCount || 0}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
