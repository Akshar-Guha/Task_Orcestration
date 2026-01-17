'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { DailyEntry } from '@/lib/diary-types';

interface QuestionAnswer {
  id: string;
  questionText: string;
  answer: string;
}

interface Image {
  id: string;
  url: string;
  caption?: string;
}

export default function DiaryEntryPage() {
  const params = useParams();
  const date = params.date as string;
  
  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (date) fetchEntry();
  }, [date]);

  async function fetchEntry() {
    try {
      setLoading(true);
      const res = await fetch(`/api/diary?date=${date}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch entry');
      }
      
      setEntry(data.entry);
      
      // Fetch images if entry exists
      if (data.entry?.id) {
        const imgRes = await fetch(`/api/diary/images?entryId=${data.entry.id}`);
        const imgData = await imgRes.json();
        if (imgRes.ok) {
          setImages(imgData.images || []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const moodEmoji = entry?.mood ? ['😢', '😕', '😐', '🙂', '😊'][entry.mood - 1] : '❓';
  const energyBar = entry?.energyLevel 
    ? '█'.repeat(entry.energyLevel) + '░'.repeat(10 - entry.energyLevel)
    : 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/diary" className="text-white/60 hover:text-white transition">
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-white">📔 Entry</h1>
          </div>
          {entry && (
            <Link 
              href={`/diary/new?date=${date}&edit=${entry.id}`}
              className="px-3 py-1 text-sm bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition"
            >
              Edit
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
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

        {!loading && !entry && !error && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Entry for {formattedDate}</h2>
            <p className="text-white/60 mb-6">Create an entry for this day to start tracking.</p>
            <Link 
              href={`/diary/new?date=${date}`}
              className="inline-flex px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition"
            >
              Create Entry
            </Link>
          </div>
        )}

        {!loading && entry && (
          <div className="space-y-8">
            {/* Date Header */}
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white">{formattedDate}</h2>
            </div>

            {/* Metrics Card */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-4xl mb-2">{moodEmoji}</div>
                  <div className="text-white/60 text-sm">Mood</div>
                  <div className="text-white font-bold">{entry.mood || 'N/A'}/5</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">⚡</div>
                  <div className="text-white/60 text-sm">Energy</div>
                  <div className="font-mono text-xs text-purple-400">{energyBar}</div>
                  <div className="text-white font-bold">{entry.energyLevel || 'N/A'}/10</div>
                </div>
              </div>
            </div>

            {/* Summary */}
            {entry.summary && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-3">📝 Summary</h3>
                <p className="text-white/80 whitespace-pre-wrap">{entry.summary}</p>
              </div>
            )}

            {/* Wins */}
            {entry.wins && entry.wins.length > 0 && (
              <div className="bg-green-500/10 rounded-2xl border border-green-500/30 p-6">
                <h3 className="text-lg font-bold text-green-400 mb-3">🏆 Wins</h3>
                <ul className="space-y-2">
                  {entry.wins.map((win, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/80">
                      <span className="text-green-400">✓</span>
                      {win}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Challenges */}
            {entry.challenges && entry.challenges.length > 0 && (
              <div className="bg-amber-500/10 rounded-2xl border border-amber-500/30 p-6">
                <h3 className="text-lg font-bold text-amber-400 mb-3">⚠️ Challenges</h3>
                <ul className="space-y-2">
                  {entry.challenges.map((challenge, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/80">
                      <span className="text-amber-400">•</span>
                      {challenge}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Productivity */}
            {entry.productivityData && Object.keys(entry.productivityData).length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-3">⏱️ Productivity</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(entry.productivityData)
                    .filter(([_, v]) => v && v > 0)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                        <span className="text-white/60 capitalize">{key.replace('_', ' ')}</span>
                        <span className="text-white font-bold">{value} min</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Images */}
            {images.length > 0 && (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-3">📷 Photos</h3>
                <div className="grid grid-cols-2 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden">
                      <img src={img.url} alt={img.caption || 'Diary photo'} className="w-full h-full object-cover" />
                      {img.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-sm text-white/80">
                          {img.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
