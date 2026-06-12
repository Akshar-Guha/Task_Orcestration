'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const MOODS = [
  { value: 1, emoji: '😢', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
];

export default function CapturePage() {
  const [text, setText] = useState('');
  const [mood, setMood] = useState<number>(0);
  const [question, setQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ entry: string; tasksCreated: number; suggestedGoals: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One adaptive question of the day - non-blocking, page works without it
  useEffect(() => {
    fetch('/api/diary/questions/adaptive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ includeSystemQuestions: true }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const q = data?.questions?.[0]?.questionText;
        if (q) setQuestion(q);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !mood) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CAPTURE_TOKEN || ''}`,
        },
        body: JSON.stringify({
          text: text.trim() || undefined,
          extracted: mood ? { mood } : undefined,
          source: 'pwa',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setResult({ entry: data.entry, tasksCreated: data.tasksCreated, suggestedGoals: data.suggestedGoals || [] });
      setText('');
      setMood(0);
    } catch {
      setError('Network error - try again');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="text-6xl">✅</div>
          <p className="text-slate-200 text-lg">
            Entry {result.entry}
            {result.tasksCreated > 0 && ` · ${result.tasksCreated} task${result.tasksCreated > 1 ? 's' : ''} added`}
          </p>
          {result.suggestedGoals.length > 0 && (
            <div className="text-left bg-slate-900 rounded-xl p-4 space-y-2">
              <p className="text-slate-400 text-sm">Possible goals spotted:</p>
              {result.suggestedGoals.map((g) => (
                <p key={g} className="text-slate-200 text-sm">• {g}</p>
              ))}
              <Link href="/create" className="text-indigo-400 text-sm underline">
                Create a goal →
              </Link>
            </div>
          )}
          <button
            onClick={() => setResult(null)}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium"
          >
            Capture more
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="max-w-sm w-full space-y-5">
        <h1 className="text-slate-100 text-xl font-semibold text-center">Capture</h1>

        {question && (
          <p className="text-slate-400 text-sm text-center italic">{question}</p>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind? Thoughts, tasks, wins, anything…"
          rows={6}
          className="w-full rounded-xl bg-slate-900 border border-slate-800 text-slate-100 p-4 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          autoFocus
        />

        <div className="flex justify-between">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(mood === m.value ? 0 : m.value)}
              className={`flex flex-col items-center p-2 rounded-xl text-2xl transition ${
                mood === m.value ? 'bg-indigo-600/30 ring-1 ring-indigo-500' : 'bg-slate-900'
              }`}
            >
              {m.emoji}
              <span className="text-[10px] text-slate-400 mt-1">{m.label}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || (!text.trim() && !mood)}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-40"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
