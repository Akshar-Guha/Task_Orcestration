'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const MOODS = [
  { value: 1, emoji: '😢', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
];

export default function QuickCheckInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const moodFromUrl = parseInt(searchParams.get('mood') || '0', 10);
  const savedFromEmail = searchParams.get('saved') === 'true';

  const [mood, setMood] = useState<number>(moodFromUrl || 0);
  const [win, setWin] = useState('');
  const [challenge, setChallenge] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [topGoal, setTopGoal] = useState<string | null>(null);

  // If mood was saved from email tap, skip straight to "add details" view
  const [moodAlreadySaved] = useState(savedFromEmail && moodFromUrl > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mood) return;

    setLoading(true);
    try {
      const res = await fetch('/api/diary/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, win, challenge }),
      });
      const data = await res.json();
      if (res.ok) {
        setStreak(data.streak || 0);
        setTopGoal(data.topGoal || null);
        setDone(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="text-6xl">🔥</div>
          <div>
            <h1 className="text-2xl font-bold text-white">Saved!</h1>
            {streak > 0 && (
              <p className="text-slate-400 mt-1">
                Streak: <span className="text-amber-400 font-semibold">{streak} day{streak !== 1 ? 's' : ''}</span>
              </p>
            )}
          </div>
          {topGoal && (
            <div className="bg-slate-800 rounded-xl p-4 text-left">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tomorrow's focus</p>
              <p className="text-white font-medium">{topGoal}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Link
              href="/diary"
              className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm text-center hover:bg-slate-700 transition-colors"
            >
              View Diary
            </Link>
            <Link
              href="/dashboard"
              className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm text-center hover:bg-violet-500 transition-colors"
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          {moodAlreadySaved ? (
            <>
              <div className="text-5xl mb-3">{MOODS.find(m => m.value === moodFromUrl)?.emoji}</div>
              <h1 className="text-2xl font-bold text-white">Mood saved!</h1>
              <p className="text-slate-400 mt-1 text-sm">Anything to add? (optional)</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white">How was today?</h1>
              <p className="text-slate-400 mt-1 text-sm">30 seconds, that's all</p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mood selector — always shown, pre-selected if from email */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 text-center">
              {moodAlreadySaved ? 'Change mood' : 'Your mood'}
            </p>
            <div className="flex justify-between gap-2">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                    mood === m.value
                      ? 'border-violet-500 bg-violet-500/20 scale-105'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs text-slate-400">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Win */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
              One win today
            </label>
            <input
              type="text"
              value={win}
              onChange={e => setWin(e.target.value)}
              placeholder="e.g. finished a feature, went for a walk..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
            />
          </div>

          {/* Challenge */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
              One challenge
            </label>
            <input
              type="text"
              value={challenge}
              onChange={e => setChallenge(e.target.value)}
              placeholder="e.g. felt distracted, skipped gym..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!mood || loading}
            className="w-full py-4 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving...' : 'Save →'}
          </button>
        </form>

        {/* Link to full diary */}
        <p className="text-center text-xs text-slate-600">
          Want to add more?{' '}
          <Link href="/diary/new" className="text-violet-400 hover:text-violet-300">
            Open full diary
          </Link>
        </p>
      </div>
    </div>
  );
}
