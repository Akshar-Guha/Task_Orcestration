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

  // Get current time as default (computed inline)
  const _d = new Date(); const defaultTime = String(_d.getHours()).padStart(2, '0') + ':' + String(_d.getMinutes()).padStart(2, '0');

  const [wakeTime, setWakeTime] = useState(defaultTime);
  const [mood, setMood] = useState<MoodLevel | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!mood) return;

    setIsSubmitting(true);

    try {
      // Capture actual submit time so the offset is accurate even if the user sat on the modal
      const now = new Date();
      // Calculate adjusted minutes from selected time vs now
      const [hours, minutes] = wakeTime.split(':').map(Number);
      const selectedTime = new Date();
      selectedTime.setHours(hours, minutes, 0, 0);
      const adjustedMinutes = Math.max(0, Math.round((now.getTime() - selectedTime.getTime()) / (1000 * 60)));

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

  const moods: { level: MoodLevel; label: string; icon: string }[] = [
    { level: 5, label: 'Amazing', icon: 'â˜…â˜…â˜…' },
    { level: 4, label: 'Good',    icon: 'â˜…â˜…'  },
    { level: 3, label: 'Okay',    icon: 'â˜…'   },
    { level: 2, label: 'Tired',   icon: 'â€”'   },
    { level: 1, label: 'Awful',   icon: 'âœ•'   },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(6,11,17,0.92)' }}
    >
      <div
        className="max-w-md w-full rounded-2xl p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-family-body)',
        }}
      >
        {/* Header */}
        <div className="mb-5">
          <h2
            className="text-2xl font-semibold leading-tight"
            style={{ color: 'var(--text)' }}
          >
            Good Morning
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--text-2)' }}
          >
            New day, fresh start â€” yesterday&apos;s tasks will reset.
          </p>
        </div>

        {/* Divider */}
        <div
          className="mb-5"
          style={{ height: '1px', background: 'var(--border)' }}
        />

        {/* Wake Time Picker */}
        <div className="mb-5">
          <label
            className="block text-xs font-medium mb-2 uppercase tracking-widest"
            style={{ color: 'var(--text-2)' }}
          >
            Wake-up time
          </label>
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-center text-xl outline-none transition-colors"
            style={{
              background: 'var(--elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'var(--font-family-mono)',
            }}
          />
        </div>

        {/* Mood Selector */}
        <div className="mb-6">
          <label
            className="block text-xs font-medium mb-2 uppercase tracking-widest"
            style={{ color: 'var(--text-2)' }}
          >
            How are you feeling?
          </label>
          <div className="grid grid-cols-5 gap-2">
            {moods.map((m) => {
              const isSelected = mood === m.level;
              return (
                <button
                  key={m.level}
                  onClick={() => setMood(m.level)}
                  className="py-3 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95"
                  style={{
                    background: isSelected ? 'var(--gold-dim)' : 'var(--elevated)',
                    border: isSelected
                      ? '1px solid var(--gold)'
                      : '1px solid var(--border)',
                    color: isSelected ? 'var(--gold)' : 'var(--text-2)',
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ fontFamily: 'var(--font-family-mono)' }}
                  >
                    {m.icon}
                  </span>
                  <span
                    className="text-[10px] leading-tight text-center"
                    style={{ color: isSelected ? 'var(--gold)' : 'var(--text-2)' }}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: 'var(--elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
            }}
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={!mood || isSubmitting}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{
              background: mood ? 'var(--sky-dim)' : 'var(--elevated)',
              border: `1px solid ${mood ? 'var(--sky)' : 'var(--border)'}`,
              color: mood ? 'var(--sky)' : 'var(--text-2)',
            }}
          >
            {isSubmitting ? 'Starting Day...' : 'Start Day'}
          </button>
        </div>
      </div>
    </div>
  );
}



