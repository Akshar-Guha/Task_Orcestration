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
  
  if (todayLog?.sleepTime) {
    lastSleepTime = todayLog.sleepTime;
    // Simple logic: If sleep recorded today, assuming sleeping.
    // Enhanced logic needs real-time interaction tracking which requires context/provider we are skipping for now.
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
            className="w-full py-4 rounded-2xl bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-900/60 hover:border-indigo-400 transition-all flex items-center justify-center gap-3 group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">😴</span>
            <div className="text-left">
              <div className="font-bold text-lg">Going to Sleep</div>
              {lastSleepTime && (
                <div className="text-xs text-indigo-400">Last attempt: {lastSleepTime}</div>
              )}
            </div>
          </motion.button>
        ) : (
          <motion.button
            key="sleeping"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={handleSleep} // Clicking again updates the time
            className="w-full py-4 rounded-2xl bg-emerald-900/40 border border-emerald-500/30 text-emerald-200 flex items-center justify-center gap-3"
          >
            <span className="text-2xl animate-pulse">🌙</span>
            <div className="text-left">
              <div className="font-bold text-lg">Good Night!</div>
              <div className="text-xs text-emerald-400">Sleeping since {lastSleepTime}</div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
