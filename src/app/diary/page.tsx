'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DailyEntry } from '@/lib/diary-types';

export default function DiaryPage() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    try {
      setLoading(true);
      const res = await fetch('/api/diary?limit=30');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch entries');
      }
      
      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  const todayDate = new Date().toISOString().split('T')[0];
  const hasToday = entries.some(e => e.date === todayDate);

  // Mood emoji mapping
  const moodEmoji = (mood?: number) => {
    if (!mood) return '❓';
    const emojis = ['😢', '😕', '😐', '🙂', '😊'];
    return emojis[mood - 1] || '❓';
  };

  // Energy bar
  const energyBar = (energy?: number) => {
    if (!energy) return null;
    const filled = '█'.repeat(energy);
    const empty = '░'.repeat(10 - energy);
    return <span className="font-mono text-xs">{filled}{empty}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-white/60 hover:text-white transition">
                ← Back
              </Link>
              <h1 className="text-xl font-bold text-white">📔 Daily Diary</h1>
            </div>
            {!hasToday && (
              <Link 
                href={`/diary/new?date=${todayDate}`}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition shadow-lg shadow-purple-500/20"
              >
                + Today&apos;s Entry
              </Link>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Link 
              href="/diary/search"
              className="px-3 py-1.5 bg-white/5 text-white/70 text-sm rounded-lg hover:bg-white/10 transition"
            >
              🔍 Search
            </Link>
            <Link 
              href="/diary/stats"
              className="px-3 py-1.5 bg-white/5 text-white/70 text-sm rounded-lg hover:bg-white/10 transition"
            >
              📊 Stats
            </Link>
            <Link 
              href="/diary/calendar"
              className="px-3 py-1.5 bg-white/5 text-white/70 text-sm rounded-lg hover:bg-white/10 transition"
            >
              📅 Calendar
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📔</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Diary Entries Yet</h2>
            <p className="text-white/60 mb-6">Start your journaling journey by creating your first entry.</p>
            <Link 
              href={`/diary/new?date=${todayDate}`}
              className="inline-flex px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition shadow-lg shadow-purple-500/20"
            >
              Create First Entry
            </Link>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-4">
            {entries.map((entry) => {
              const isToday = entry.date === todayDate;
              const entryDate = new Date(entry.date + 'T00:00:00');
              const dayName = entryDate.toLocaleDateString('en-US', { weekday: 'long' });
              const formattedDate = entryDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: entryDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
              });

              return (
                <Link
                  key={entry.id}
                  href={`/diary/${entry.date}`}
                  className={`block p-5 rounded-xl border transition-all hover:scale-[1.01] ${
                    isToday 
                      ? 'bg-gradient-to-r from-purple-500/20 to-violet-500/20 border-purple-500/50' 
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Date & Day */}
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-white">{formattedDate}</div>
                      <div className="text-sm text-white/60">{dayName}</div>
                      {isToday && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded-full">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{moodEmoji(entry.mood)}</span>
                          {entry.mood && <span className="text-white/60 text-sm">{entry.mood}/5</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/60">⚡</span>
                          {energyBar(entry.energyLevel)}
                          {entry.energyLevel && <span className="text-white/60 text-sm">{entry.energyLevel}/10</span>}
                        </div>
                      </div>

                      {/* Summary preview */}
                      {entry.summary && (
                        <p className="text-white/80 line-clamp-2 text-sm">
                          {entry.summary}
                        </p>
                      )}

                      {/* Wins & Challenges count */}
                      <div className="flex gap-4 mt-3 text-xs">
                        {entry.wins && entry.wins.length > 0 && (
                          <span className="text-green-400">✓ {entry.wins.length} wins</span>
                        )}
                        {entry.challenges && entry.challenges.length > 0 && (
                          <span className="text-amber-400">⚠ {entry.challenges.length} challenges</span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="text-white/40 text-xl">→</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
