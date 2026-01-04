'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { MoodLevel } from '@/lib/types';
import { AnimatePresence, motion } from 'framer-motion';

export function WakeUpModal() {
  const { getTodaySleepLog, recordWakeUp } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [isEditing, setIsEditing] = useState(false);
  const [adjustedMinutes, setAdjustedMinutes] = useState(0);
  const [mood, setMood] = useState<MoodLevel | undefined>(undefined);
  const [timerActive, setTimerActive] = useState(true);

  // Check if we need to show the modal
  useEffect(() => {
    // Only run on client
    const todayLog = getTodaySleepLog();
    const currentHour = new Date().getHours();
    
    // Show if:
    // 1. No wake up recorded for today
    // 2. It's morning (e.g., between 4 AM and 12 PM)
    if (!todayLog?.wakeUpTime && currentHour >= 4 && currentHour < 12) {
      // Use setTimeout to avoid synchronous state update warning during effect
      const timer = setTimeout(() => setIsOpen(true), 100);
      return () => clearTimeout(timer);
    }
  }, [getTodaySleepLog]);

  const handleConfirm = useCallback(() => {
    recordWakeUp(adjustedMinutes, mood);
    // Use setTimeout to avoid synchronous state update warning during effect
    setTimeout(() => setIsOpen(false), 0);
  }, [adjustedMinutes, mood, recordWakeUp]);

  // Timer logic
  useEffect(() => {
    if (!isOpen || !timerActive || secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timerActive, secondsLeft]);

  // Handle timer completion
  useEffect(() => {
    if (isOpen && timerActive && secondsLeft === 0) {
      handleConfirm();
    }
  }, [secondsLeft, isOpen, timerActive, handleConfirm]);

  const handleStopTimer = () => {
    setTimerActive(false);
    setIsEditing(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-slate-900 border border-violet-500/30 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Background Progress Bar */}
          {timerActive && (
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 10, ease: 'linear' }}
              className="absolute top-0 left-0 h-1 bg-violet-500"
            />
          )}

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Good Morning! ☀️</h2>
            <p className="text-slate-400">
              {timerActive 
                ? `Logging wake up time in ${secondsLeft}s...` 
                : "Adjust your wake up time"}
            </p>
          </div>

          {!isEditing ? (
            <div className="space-y-3">
              <div className="text-4xl font-mono text-white font-bold text-center py-4">
                {new Date().toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  hour12: false 
                })}
              </div>

              <button
                onClick={handleStopTimer}
                className="w-full py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium"
              >
                Wait, I woke up earlier...
              </button>

              <button
                onClick={handleConfirm}
                className="w-full py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-bold shadow-lg shadow-violet-500/20"
              >
                Confirm Now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">I woke up:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 10, 30].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setAdjustedMinutes(mins)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        adjustedMinutes === mins
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {mins === 0 ? 'Just now' : `${mins}m ago`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">My Mood:</label>
                <div className="flex justify-between bg-slate-800/50 p-2 rounded-xl">
                  {([1, 2, 3, 4, 5] as MoodLevel[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all ${
                        mood === m
                          ? 'bg-violet-600 scale-110 shadow-lg'
                          : 'hover:bg-slate-700 text-slate-500'
                      }`}
                    >
                      {['😫', '😕', '😐', '🙂', '🤩'][m - 1]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfirm}
                className="w-full py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-bold mt-4"
              >
                Save
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
