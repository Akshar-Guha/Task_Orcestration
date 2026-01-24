'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { WakeUpModal } from '@/components/sleep/WakeUpModal';
import { useSleepLogs, useRecordSleep } from '@/lib/hooks/useSupabase';

// Quick Actions component for manual wake-up/sleep entry
function QuickActions() {
  const [showWakeUpModal, setShowWakeUpModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const { data: sleepWakeLogs = [] } = useSleepLogs();
  const recordSleepMutation = useRecordSleep();
  
  const today = new Date().toISOString().split('T')[0];
  const todayLog = sleepWakeLogs.find(log => log.date === today);
  
  const handleRecordSleep = async () => {
    setLoading(true);
    setMessage('');
    try {
      await recordSleepMutation.mutateAsync();
      setMessage('✅ Sleep time recorded!');
    } catch {
      setMessage('❌ Failed to record sleep');
    }
    setLoading(false);
  };
  
  return (
    <>
      {showWakeUpModal && (
        <WakeUpModal onClose={() => {
          setShowWakeUpModal(false);
          setMessage('✅ Wake-up time recorded!');
        }} />
      )}
      
      <div className="mb-8 p-5 bg-gradient-to-br from-indigo-900/30 to-violet-900/30 border border-indigo-500/30 rounded-2xl">
        <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Record Wake-Up */}
          <button
            onClick={() => setShowWakeUpModal(true)}
            disabled={loading || !!todayLog?.wakeUpTime}
            className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95
              ${todayLog?.wakeUpTime 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
              }`}
          >
            <span className="text-2xl">☀️</span>
            <span className="text-sm font-medium">
              {todayLog?.wakeUpTime ? `Woke at ${todayLog.wakeUpTime}` : 'Record Wake-Up'}
            </span>
          </button>
          
          {/* Record Sleep */}
          <button
            onClick={handleRecordSleep}
            disabled={loading || !!todayLog?.sleepTime}
            className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95
              ${todayLog?.sleepTime 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/30'
              }`}
          >
            <span className="text-2xl">🌙</span>
            <span className="text-sm font-medium">
              {loading ? 'Recording...' : todayLog?.sleepTime ? `Slept at ${todayLog.sleepTime}` : 'Going to Sleep'}
            </span>
          </button>
        </div>
        
        {message && (
          <div className={`mt-3 p-2 rounded-lg text-sm text-center ${
            message.startsWith('✅') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message}
          </div>
        )}
        
        {!todayLog?.wakeUpTime && !todayLog?.sleepTime && (
          <p className="text-xs text-slate-500 mt-3 text-center">
            Tip: Record wake-up in the morning, sleep at night
          </p>
        )}
      </div>
    </>
  );
}

export default function SleepPage() {
  const { data: logs = [] } = useSleepLogs();

  const getSleepStats = () => {
    if (logs.length === 0) return {
      averageMood: 0,
      averageSleepDuration: 0,
      sleepDebtMinutes: 0
    };

    const totalMood = logs.reduce((sum, log) => sum + (log.wakeUpMood || 0), 0);
    const totalDuration = logs.reduce((sum, log) => sum + (log.sleepDurationMinutes || 0), 0);
    const targetMinutes = 8 * 60;
    const totalDebt = logs.reduce((sum, log) => {
      if (!log.sleepDurationMinutes) return sum;
      return sum + (targetMinutes - log.sleepDurationMinutes);
    }, 0);

    return {
      averageMood: totalMood / (logs.length || 1) / 5, // Normalize to 0-1
      averageSleepDuration: Math.round(totalDuration / (logs.length || 1)),
      sleepDebtMinutes: totalDebt
    };
  };

  const stats = getSleepStats();

  const getMoodEmoji = (level?: number) => {
    switch (level) {
      case 5: return '🤩';
      case 4: return '🙂';
      case 3: return '😐';
      case 2: return '😫';
      case 1: return '💀';
      default: return '❓';
    }
  };

  const getDurationColor = (minutes: number) => {
    if (minutes >= 480) return 'text-emerald-400'; // 8h+
    if (minutes >= 420) return 'text-blue-400';    // 7h+
    if (minutes >= 360) return 'text-yellow-400';  // 6h+
    return 'text-red-400';                         // <6h
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/profile"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Sleep Insights</h1>
            <p className="text-sm text-slate-500">Track your rest and recovery</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="text-slate-400 text-sm mb-1">Avg Score</div>
            <div className="text-2xl font-bold text-indigo-400">{Math.round(stats.averageMood * 20)}%</div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="text-slate-400 text-sm mb-1">Avg Duration</div>
            <div className="text-2xl font-bold text-violet-400">
              {Math.floor(stats.averageSleepDuration / 60)}h {stats.averageSleepDuration % 60}m
            </div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="text-slate-400 text-sm mb-1">Total Debt</div>
            <div className={`text-2xl font-bold ${stats.sleepDebtMinutes > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {Math.floor(Math.abs(stats.sleepDebtMinutes) / 60)}h
            </div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="text-slate-400 text-sm mb-1">Logged</div>
            <div className="text-2xl font-bold text-amber-400">{logs.length} Days</div>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Sleep Logs List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white mb-4">Recent History</h2>
          
          {logs.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
              <div className="text-4xl mb-3">😴</div>
              <h3 className="text-lg font-medium text-white">No sleeps logged yet</h3>
              <p className="text-slate-500 text-sm mt-1">
                Use the &quot;Going to Sleep&quot; button on the dashboard to start tracking.
              </p>
            </div>
          ) : (
            logs.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 flex flex-col items-center justify-center rounded-lg bg-slate-800 text-xl">
                    {getMoodEmoji(log.wakeUpMood)}
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {new Date(log.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs text-slate-500 flex gap-2">
                      <span>💤 {log.sleepTime || '--:--'}</span>
                      <span>☀️ {log.wakeUpTime || '--:--'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  {log.sleepDurationMinutes ? (
                    <>
                      <div className={`text-lg font-bold ${getDurationColor(log.sleepDurationMinutes)}`}>
                        {Math.floor(log.sleepDurationMinutes / 60)}h {log.sleepDurationMinutes % 60}m
                      </div>
                      <div className="text-xs text-slate-500">
                        {log.sleepDurationMinutes >= 480 ? 'Target met' : `${480 - log.sleepDurationMinutes}m debt`}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">In progress...</div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
