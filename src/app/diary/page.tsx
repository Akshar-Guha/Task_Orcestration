'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DailyEntry } from '@/lib/diary-types';
import { getLocalDateString } from '@/lib/date-utils';

import { DiaryNav } from '@/components/diary/DiaryNav';

export default function DiaryPage() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [todayDate, setTodayDate] = useState('');

  useEffect(() => {
    fetchEntries();
    // Set date on client side to ensure local timezone matches user's device
    setTodayDate(getLocalDateString());
  }, []);

  async function fetchEntries() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/diary?limit=30', {
        headers: {
          'x-user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      // Log the raw response for debugging
      const text = await res.text();
      console.log('[Diary] Raw response:', text.substring(0, 200));

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[Diary] JSON parse failed:', parseError);
        console.error('[Diary] Response text:', text);
        throw new Error('API returned invalid JSON. Check console for details.');
      }

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

  // Calculate hasToday based on client-side todayDate
  const hasToday = todayDate ? entries.some(e => e.date === todayDate) : false;

  // Mood emoji mapping
  const moodEmoji = (mood?: number) => {
    if (!mood) return 'â€”';
    const emojis = ['ðŸ˜¢', 'ðŸ˜•', 'ðŸ˜', 'ðŸ™‚', 'ðŸ˜Š'];
    return emojis[mood - 1] || 'â€”';
  };

  // Energy bar
  const energyBar = (energy?: number) => {
    if (!energy) return null;
    const filled = 'â–ˆ'.repeat(energy);
    const empty = 'â–‘'.repeat(10 - energy);
    return (
      <span
        className="text-xs"
        style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--jade)' }}
      >
        {filled}
        <span style={{ color: 'var(--text-3)' }}>{empty}</span>
      </span>
    );
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg)', fontFamily: 'var(--font-family-body)' }}
    >
      {/* Header */}
      <header
        className="sticky z-10"
        style={{ top: "var(--header-h)", background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1
            className="text-xl font-semibold tracking-wide"
            style={{
              color: 'var(--text)',
              fontFamily: 'var(--font-family-display)',
              fontStyle: 'italic',
              letterSpacing: '0.04em',
            }}
          >
            Daily Diary
          </h1>
          {!hasToday && (
            <Link
              href={`/diary/new?date=${todayDate}`}
              className="px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85"
              style={{
                background: 'var(--gold-dim)',
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
                borderRadius: '10px',
                fontFamily: 'var(--font-family-body)',
              }}
            >
              + Today&apos;s Entry
            </Link>
          )}
        </div>
        <DiaryNav />
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div
              className="animate-spin rounded-full h-7 w-7"
              style={{
                border: '2px solid var(--border)',
                borderTopColor: 'var(--gold)',
              }}
            />
          </div>
        )}

        {error && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{
              background: 'rgba(220,60,60,0.08)',
              border: '1px solid rgba(220,60,60,0.3)',
              color: '#e07070',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-24">
            <p
              className="text-5xl mb-5"
              style={{
                fontFamily: 'var(--font-family-display)',
                fontStyle: 'italic',
                color: 'var(--text-3)',
                fontSize: '3rem',
              }}
            >
              No entries yet
            </p>
            <p
              className="mb-8 text-sm"
              style={{ color: 'var(--text-2)', lineHeight: 1.7 }}
            >
              Start your journaling journey by creating your first entry.
            </p>
            <Link
              href={`/diary/new?date=${todayDate}`}
              className="inline-flex px-6 py-3 text-sm font-medium transition-opacity hover:opacity-85"
              style={{
                background: 'var(--gold-dim)',
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
                borderRadius: '12px',
              }}
            >
              Create First Entry
            </Link>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isToday = entry.date === todayDate;
              const entryDate = new Date(entry.date + 'T00:00:00');
              const dayName = entryDate.toLocaleDateString('en-US', { weekday: 'long' });
              const formattedDate = entryDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year:
                  entryDate.getFullYear() !== new Date().getFullYear()
                    ? 'numeric'
                    : undefined,
              });

              return (
                <Link
                  key={entry.id}
                  href={`/diary/${entry.date}`}
                  className="block transition-all hover:scale-[1.005]"
                  style={{
                    background: isToday ? 'var(--gold-dim)' : 'var(--surface)',
                    border: isToday
                      ? '1px solid var(--gold)'
                      : '1px solid var(--border)',
                    borderRadius: '14px',
                    padding: '20px 22px',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Date & Day */}
                    <div className="flex-shrink-0" style={{ minWidth: '88px' }}>
                      <div
                        className="font-semibold"
                        style={{
                          fontFamily: 'var(--font-family-display)',
                          fontStyle: 'italic',
                          fontSize: '1.25rem',
                          color: isToday ? 'var(--gold)' : 'var(--text)',
                          lineHeight: 1.2,
                        }}
                      >
                        {formattedDate}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--text-2)' }}
                      >
                        {dayName}
                      </div>
                      {isToday && (
                        <span
                          className="inline-block mt-2 px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: 'var(--gold-dim)',
                            color: 'var(--gold)',
                            border: '1px solid var(--gold)',
                            borderRadius: '6px',
                          }}
                        >
                          Today
                        </span>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-5 mb-3">
                        {entry.mood && (
                          <div className="flex items-center gap-2">
                            <span className="text-base">{moodEmoji(entry.mood)}</span>
                            <span
                              className="text-xs"
                              style={{ color: 'var(--text-2)' }}
                            >
                              {entry.mood}/5
                            </span>
                          </div>
                        )}
                        {entry.energyLevel && (
                          <div className="flex items-center gap-2">
                            {energyBar(entry.energyLevel)}
                            <span
                              className="text-xs"
                              style={{ color: 'var(--text-2)' }}
                            >
                              {entry.energyLevel}/10
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Summary preview */}
                      {entry.summary && (
                        <p
                          className="text-sm line-clamp-2"
                          style={{
                            color: 'var(--text)',
                            lineHeight: 1.7,
                          }}
                        >
                          {entry.summary}
                        </p>
                      )}

                      {/* Wins & Challenges count */}
                      <div className="flex gap-4 mt-3">
                        {entry.wins && entry.wins.length > 0 && (
                          <span
                            className="text-xs font-medium"
                            style={{ color: 'var(--jade)' }}
                          >
                            {entry.wins.length} win{entry.wins.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {entry.challenges && entry.challenges.length > 0 && (
                          <span
                            className="text-xs font-medium"
                            style={{ color: 'var(--gold)' }}
                          >
                            {entry.challenges.length} challenge{entry.challenges.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div
                      className="text-sm flex-shrink-0 self-center"
                      style={{ color: 'var(--text-3)' }}
                    >
                      &rarr;
                    </div>
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
