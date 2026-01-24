'use client';

import { useState } from 'react';
import { useRecordWakeUp, useResetDailyTasks } from '@/lib/hooks/useSupabase';
import type { MoodLevel } from '@/lib/types';

interface WakeUpModalProps {
  onClose: () => void;
}

export function WakeUpModal({ onClose }: WakeUpModalProps) {
  const recordWakeUpMutation = useRecordWakeUp();
  const resetDailyTasksMutation = useResetDailyTasks();
  
  // Get current time as default
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const [wakeTime, setWakeTime] = useState(defaultTime);
  const [mood, setMood] = useState<MoodLevel | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!mood) return;
    
    setIsSubmitting(true);
    
    try {
      // Calculate adjusted minutes from selected time vs now
      const [hours, minutes] = wakeTime.split(':').map(Number);
      const selectedTime = new Date();
      selectedTime.setHours(hours, minutes, 0, 0);
      const adjustedMinutes = Math.round((now.getTime() - selectedTime.getTime()) / (1000 * 60));
      
      // 1. Reset daily tasks (server-side via mutation)
      await resetDailyTasksMutation.mutateAsync();
      
      // 2. Record wake-up time and mood
      await recordWakeUpMutation.mutateAsync({ adjustedMinutes, mood });
      
      onClose();
    } catch (err) {
      console.error('[WakeUpModal] Error:', err);
      // Optional: Show error toast
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const moods: { level: MoodLevel; emoji: string; label: string }[] = [
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
        <p className="text-slate-400 text-sm mb-6">New day, fresh start! Yesterday&apos;s tasks will reset.</p>

        {/* Wake Time Picker */}
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-2">
            What time did you wake up?
          </label>
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-center text-xl"
          />
        </div>

        {/* Mood Selector */}
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-2">
            How are you feeling?
          </label>
          <div className="grid grid-cols-5 gap-2">
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
            disabled={!mood || isSubmitting}
            className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold rounded-xl disabled:opacity-40 transition-all"
          >
            {isSubmitting ? 'Starting Day...' : 'Start Day ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
