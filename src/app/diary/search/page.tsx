'use client';

import { useState } from 'react';
import Link from 'next/link';

interface SearchResult {
  id: string;
  date: string;
  summary: string;
  mood: number;
  similarity: number;
}

export default function DiarySearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/diary/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 10 }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }

  const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/diary" className="text-white/60 hover:text-white transition">
              ← Back
            </Link>
            <h1 className="text-xl font-bold text-white">🔍 Search Diary</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your diary... (e.g., 'happy moments', 'work challenges')"
              className="flex-1 p-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </form>

        {results.length > 0 && (
          <div className="space-y-4">
            <p className="text-white/60 text-sm">Found {results.length} entries</p>
            {results.map((result) => (
              <Link
                key={result.id}
                href={`/diary/${result.date}`}
                className="block p-5 bg-white/5 border border-white/10 rounded-xl hover:border-purple-500/50 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{moodEmojis[result.mood - 1] || '❓'}</span>
                      <span className="text-white font-medium">{result.date}</span>
                      {result.similarity && (
                        <span className="text-xs text-purple-400">
                          {Math.round(result.similarity * 100)}% match
                        </span>
                      )}
                    </div>
                    <p className="text-white/80">{result.summary}</p>
                  </div>
                  <div className="text-white/40">→</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-white/60">No entries found for &quot;{query}&quot;</p>
          </div>
        )}
      </main>
    </div>
  );
}
