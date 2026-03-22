'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ApiResponse {
  streak: {
    current_streak: number;
    longest_streak: number;
    last_entry_date: string | null;
  };
  weeklyStats: Array<{
    week_start: string;
    entries_count: number;
    avg_mood: number | null;
    avg_energy: number | null;
    total_deep_work: number;
    total_exercise: number;
    total_wins: number;
    total_challenges: number;
  }>;
  monthlyStats: Array<{
    month_start: string;
    entries_count: number;
    avg_mood: number | null;
    avg_energy: number | null;
    total_deep_work: number;
    total_shallow_work: number;
    total_exercise: number;
    good_mood_days: number;
    bad_mood_days: number;
  }>;
}

export default function DiaryStatsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/diary/stats');
      const json = await res.json();
      setData(json);
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

  const streak = data?.streak;
  const weekly = data?.weeklyStats?.[0];
  const monthly = data?.monthlyStats?.[0];
  const totalEntries = data?.weeklyStats?.reduce((sum, w) => sum + w.entries_count, 0) ?? 0;

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
              <div className="text-4xl font-bold text-purple-300">{streak?.current_streak ?? 0}</div>
              <div className="text-white/60 text-sm mt-1">Current</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-300">{streak?.longest_streak ?? 0}</div>
              <div className="text-white/60 text-sm mt-1">Longest</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-300">{totalEntries}</div>
              <div className="text-white/60 text-sm mt-1">Total (4 wks)</div>
            </div>
          </div>
          {streak?.last_entry_date && (
            <div className="text-center text-white/40 text-xs mt-4">
              Last entry: {new Date(streak.last_entry_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Weekly Stats */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">📅 This Week</h2>
          {weekly ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Avg Mood</div>
                <div className="text-2xl font-bold text-green-400">
                  {weekly.avg_mood != null ? `${weekly.avg_mood.toFixed(1)}/5` : 'N/A'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Avg Energy</div>
                <div className="text-2xl font-bold text-blue-400">
                  {weekly.avg_energy != null ? `${weekly.avg_energy.toFixed(1)}/10` : 'N/A'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Deep Work</div>
                <div className="text-2xl font-bold text-purple-400">{weekly.total_deep_work ?? 0}m</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Entries</div>
                <div className="text-2xl font-bold text-white">{weekly.entries_count ?? 0}</div>
              </div>
              {weekly.total_wins > 0 && (
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-sm text-white/60 mb-1">Wins</div>
                  <div className="text-2xl font-bold text-emerald-400">{weekly.total_wins}</div>
                </div>
              )}
              {weekly.total_exercise > 0 && (
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-sm text-white/60 mb-1">Exercise</div>
                  <div className="text-2xl font-bold text-orange-400">{weekly.total_exercise}m</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-white/40 text-center py-6">No entries this week yet</div>
          )}
        </div>

        {/* Monthly Stats */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">📆 This Month</h2>
          {monthly ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Avg Mood</div>
                <div className="text-2xl font-bold text-green-400">
                  {monthly.avg_mood != null ? `${monthly.avg_mood.toFixed(1)}/5` : 'N/A'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Avg Energy</div>
                <div className="text-2xl font-bold text-blue-400">
                  {monthly.avg_energy != null ? `${monthly.avg_energy.toFixed(1)}/10` : 'N/A'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Deep Work</div>
                <div className="text-2xl font-bold text-purple-400">{monthly.total_deep_work ?? 0}m</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Entries</div>
                <div className="text-2xl font-bold text-white">{monthly.entries_count ?? 0}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Good Mood Days</div>
                <div className="text-2xl font-bold text-emerald-400">{monthly.good_mood_days ?? 0}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-white/60 mb-1">Tough Mood Days</div>
                <div className="text-2xl font-bold text-rose-400">{monthly.bad_mood_days ?? 0}</div>
              </div>
            </div>
          ) : (
            <div className="text-white/40 text-center py-6">No entries this month yet</div>
          )}
        </div>
      </main>
    </div>
  );
}
