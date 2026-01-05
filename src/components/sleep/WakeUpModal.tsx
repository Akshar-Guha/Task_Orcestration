'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';

interface WakeUpModalProps {
  onClose: () => void;
}

export function WakeUpModal({ onClose }: WakeUpModalProps) {
  const { recordWakeUp } = useAppStore();
  const [mood, setMood] = useState<number | undefined>();
  const [adjustedMinutes, setAdjustedMinutes] = useState(0);

  const handleSubmit = () => {
    recordWakeUp(adjustedMinutes, mood);
    onClose();
  };

  const moods = [
    { level: 5, emoji: '🤩', label: 'Amazing' },
    { level: 4, emoji: '🙂', label: 'Good' },
    { level: 3, emoji: '😐', label: 'Okay' },
    { level: 2, emoji: '😫', label: 'Tired' },
    { level: 1, emoji: '💀', label: 'Awful' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-300">
        <h2 className="text-2xl font-bold text-white mb-2">Good Morning! 🌅</h2>
        <p className="text-slate-400 text-sm mb-6">How are you feeling?</p>

        {/* Mood Selector */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {moods.map((m) => (
            <button
              key={m.level}
              onClick={() => setMood(m.level)}
              className={`p-3 rounded-xl border-2 transition-all ${
                mood === m.level
                  ? 'border-violet-500 bg-violet-500/20 scale-105'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="text-2xl mb-1">{m.emoji}</div>
              <div className="text-[10px] text-slate-400">{m.label}</div>
            </button>
          ))}
        </div>

        {/* Time Adjustment */}
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-2">
            Woke up earlier/later? (minutes)
          </label>
          <input
            type="number"
            value={adjustedMinutes}
            onChange={(e) => setAdjustedMinutes(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-center"
          />
          <p className="text-xs text-slate-500 mt-1">+ = earlier, - = later</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={!mood}
            className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold rounded-xl disabled:opacity-40 transition-all"
          >
            Record ✓
          </button>
        </div>
      </div>
    </div>
  );
}
