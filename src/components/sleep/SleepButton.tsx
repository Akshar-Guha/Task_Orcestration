import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSleepLogs, useRecordSleep } from '@/lib/hooks/useSupabase';

export function SleepButton() {
  const { data: sleepWakeLogs = [] } = useSleepLogs();
  const recordSleepMutation = useRecordSleep();

  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  // Update hour every minute to handle time changes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Only show sleep button at night (9 PM to 6 AM)
  const isNightTime = currentHour >= 21 || currentHour < 6;

  // Derived state (no useEffect needed)
  const today = new Date().toISOString().split('T')[0];
  const todayLog = sleepWakeLogs.find(l => l.date === today);

  let status: 'awake' | 'sleeping' = 'awake';
  let lastSleepTime: string | null = null;

  if (todayLog?.sleepTime && !todayLog?.wakeUpTime) {
    lastSleepTime = todayLog.sleepTime;
    status = 'sleeping';
  }

  const handleSleep = () => {
    recordSleepMutation.mutate();
  };

  // Don't render if not night time
  if (!isNightTime) {
    return null;
  }

  return (
    <div className="w-full mb-6">
      <AnimatePresence mode="wait">
        {status === 'awake' ? (
          <motion.button
            key="awake"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleSleep}
            style={{
              background: 'var(--sky-dim)',
              border: '1px solid var(--sky)',
              color: 'var(--sky)',
              fontFamily: 'var(--font-family-body)',
            }}
            className="w-full flex items-center justify-center gap-4 rounded-2xl px-6 transition-all active:scale-[0.98]"
            // Ensure min height for big tap target
          >
            <div
              style={{ minHeight: '64px' }}
              className="flex items-center justify-center gap-4 w-full"
            >
              {/* Moon icon */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <div className="text-left">
                <div
                  className="font-semibold text-lg leading-tight"
                  style={{ color: 'var(--sky)' }}
                >
                  Going to Sleep
                </div>
                {lastSleepTime && (
                  <div
                    className="text-xs mt-0.5"
                    style={{
                      color: 'var(--text-2)',
                      fontFamily: 'var(--font-family-mono)',
                    }}
                  >
                    Last attempt: {lastSleepTime}
                  </div>
                )}
              </div>
            </div>
          </motion.button>
        ) : (
          <motion.button
            key="sleeping"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={handleSleep}
            style={{
              background: 'var(--gold-dim)',
              border: '1px solid var(--gold)',
              color: 'var(--gold)',
              fontFamily: 'var(--font-family-body)',
            }}
            className="w-full flex items-center justify-center gap-4 rounded-2xl px-6 transition-all"
          >
            <div
              style={{ minHeight: '64px' }}
              className="flex items-center justify-center gap-4 w-full"
            >
              {/* Star/sparkle icon for sleeping state */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-pulse"
                style={{ flexShrink: 0 }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <div className="text-left">
                <div
                  className="font-semibold text-lg leading-tight"
                  style={{ color: 'var(--gold)' }}
                >
                  Good Night
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{
                    color: 'var(--text-2)',
                    fontFamily: 'var(--font-family-mono)',
                  }}
                >
                  Sleeping since {lastSleepTime}
                </div>
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
