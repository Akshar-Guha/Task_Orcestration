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
      setMessage('Sleep time recorded');
    } catch {
      setMessage('Failed to record sleep');
    }
    setLoading(false);
  };

  const messageIsError = message === 'Failed to record sleep';

  return (
    <>
      {showWakeUpModal && (
        <WakeUpModal
          onClose={() => {
            setShowWakeUpModal(false);
            setMessage('Wake-up time recorded');
          }}
        />
      )}

      <div
        className="mb-8 p-5 rounded-2xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-family-body)',
        }}
      >
        <h2
          className="text-sm font-medium uppercase tracking-widest mb-4"
          style={{ color: 'var(--text-2)' }}
        >
          Quick Actions
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {/* Record Wake-Up */}
          <button
            onClick={() => setShowWakeUpModal(true)}
            disabled={loading || !!todayLog?.wakeUpTime}
            className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: todayLog?.wakeUpTime ? 'var(--elevated)' : 'var(--gold-dim)',
              border: `1px solid ${todayLog?.wakeUpTime ? 'var(--border)' : 'var(--gold)'}`,
              color: todayLog?.wakeUpTime ? 'var(--text-2)' : 'var(--gold)',
            }}
          >
            {/* Sun icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <span className="text-sm font-medium text-center leading-tight">
              {todayLog?.wakeUpTime
                ? <span style={{ fontFamily: 'var(--font-family-mono)' }}>{todayLog.wakeUpTime}</span>
                : 'Record Wake-Up'}
            </span>
          </button>

          {/* Record Sleep */}
          <button
            onClick={handleRecordSleep}
            disabled={loading || !!todayLog?.sleepTime}
            className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: todayLog?.sleepTime ? 'var(--elevated)' : 'var(--sky-dim)',
              border: `1px solid ${todayLog?.sleepTime ? 'var(--border)' : 'var(--sky)'}`,
              color: todayLog?.sleepTime ? 'var(--text-2)' : 'var(--sky)',
            }}
          >
            {/* Moon icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <span className="text-sm font-medium text-center leading-tight">
              {loading
                ? 'Recording...'
                : todayLog?.sleepTime
                  ? <span style={{ fontFamily: 'var(--font-family-mono)' }}>{todayLog.sleepTime}</span>
                  : 'Going to Sleep'}
            </span>
          </button>
        </div>

        {message && (
          <div
            className="mt-3 py-2 px-3 rounded-lg text-sm text-center"
            style={{
              background: messageIsError ? 'var(--coral-dim)' : 'var(--jade-dim)',
              color: messageIsError ? 'var(--coral)' : 'var(--jade)',
              border: `1px solid ${messageIsError ? 'var(--coral)' : 'var(--jade)'}`,
              opacity: 0.9,
            }}
          >
            {message}
          </div>
        )}

        {!todayLog?.wakeUpTime && !todayLog?.sleepTime && (
          <p
            className="text-xs mt-3 text-center"
            style={{ color: 'var(--text-3)' }}
          >
            Record wake-up in the morning, sleep at night
          </p>
        )}
      </div>
    </>
  );
}

// Duration color helper using CSS vars
function getDurationStyle(minutes: number): { color: string } {
  if (minutes >= 480) return { color: 'var(--jade)' };   // 8h+
  if (minutes >= 420) return { color: 'var(--sky)' };    // 7h+
  if (minutes >= 360) return { color: 'var(--gold)' };   // 6h+
  return { color: 'var(--coral)' };                      // <6h
}

// Mood label (no emoji)
function getMoodLabel(level?: number): string {
  switch (level) {
    case 5: return 'Amazing';
    case 4: return 'Good';
    case 3: return 'Okay';
    case 2: return 'Tired';
    case 1: return 'Awful';
    default: return 'â€”';
  }
}

// Mood color
function getMoodColor(level?: number): string {
  switch (level) {
    case 5: return 'var(--jade)';
    case 4: return 'var(--sky)';
    case 3: return 'var(--gold)';
    case 2: return 'var(--coral)';
    case 1: return 'var(--coral)';
    default: return 'var(--text-3)';
  }
}

export function ManualSleepView() {
  const { data: logs = [] } = useSleepLogs();

  const getSleepStats = () => {
    if (logs.length === 0)
      return { averageMood: 0, averageSleepDuration: 0, sleepDebtMinutes: 0 };

    const totalMood = logs.reduce((sum, log) => sum + (log.wakeUpMood || 0), 0);
    const totalDuration = logs.reduce(
      (sum, log) => sum + (log.sleepDurationMinutes || 0),
      0
    );
    const targetMinutes = 8 * 60;
    const totalDebt = logs.reduce((sum, log) => {
      if (!log.sleepDurationMinutes) return sum;
      return sum + (targetMinutes - log.sleepDurationMinutes);
    }, 0);

    return {
      averageMood: totalMood / (logs.length || 1) / 5,
      averageSleepDuration: Math.round(totalDuration / (logs.length || 1)),
      sleepDebtMinutes: totalDebt,
    };
  };

  const stats = getSleepStats();

  const avgDurationStyle = getDurationStyle(stats.averageSleepDuration);

  return (
    <div
      className="min-h-screen pb-24"
      style={{
        background: 'var(--bg)',
        fontFamily: 'var(--font-family-body)',
        color: 'var(--text)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/profile"
            className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
            }}
            aria-label="Back to profile"
          >
            {/* Left arrow SVG */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1
              className="text-2xl font-semibold leading-tight"
              style={{ color: 'var(--text)' }}
            >
              Sleep Insights
            </h1>
            <p
              className="text-sm"
              style={{ color: 'var(--text-2)' }}
            >
              Track your rest and recovery
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {/* Avg Score */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="text-xs font-medium uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-2)' }}
            >
              Avg Score
            </div>
            <div
              className="text-3xl italic leading-none"
              style={{
                color: 'var(--sky)',
                fontFamily: 'var(--font-family-display)',
              }}
            >
              {Math.round(stats.averageMood * 20)}%
            </div>
          </div>

          {/* Avg Duration */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="text-xs font-medium uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-2)' }}
            >
              Avg Duration
            </div>
            <div
              className="text-3xl italic leading-none"
              style={{
                ...avgDurationStyle,
                fontFamily: 'var(--font-family-display)',
              }}
            >
              {Math.floor(stats.averageSleepDuration / 60)}
              <span className="text-xl">h</span>
              {' '}
              {stats.averageSleepDuration % 60}
              <span className="text-xl">m</span>
            </div>
          </div>

          {/* Sleep Debt */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="text-xs font-medium uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-2)' }}
            >
              Sleep Debt
            </div>
            <div
              className="text-3xl italic leading-none"
              style={{
                color: stats.sleepDebtMinutes > 0 ? 'var(--coral)' : 'var(--jade)',
                fontFamily: 'var(--font-family-display)',
              }}
            >
              {Math.floor(Math.abs(stats.sleepDebtMinutes) / 60)}
              <span className="text-xl">h</span>
            </div>
          </div>

          {/* Logged */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="text-xs font-medium uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-2)' }}
            >
              Logged
            </div>
            <div
              className="text-3xl italic leading-none"
              style={{
                color: 'var(--gold)',
                fontFamily: 'var(--font-family-display)',
              }}
            >
              {logs.length}
              <span className="text-xl"> days</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Sleep Logs List */}
        <div>
          <h2
            className="text-sm font-medium uppercase tracking-widest mb-4"
            style={{ color: 'var(--text-2)' }}
          >
            Recent History
          </h2>

          {logs.length === 0 ? (
            <div
              className="text-center py-12 rounded-2xl"
              style={{
                background: 'var(--surface)',
                border: '1px dashed var(--border)',
              }}
            >
              {/* Sleep icon */}
              <div className="flex justify-center mb-3">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--text-3)' }}
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </div>
              <h3
                className="text-base font-medium mb-1"
                style={{ color: 'var(--text)' }}
              >
                No sleeps logged yet
              </h3>
              <p
                className="text-sm"
                style={{ color: 'var(--text-2)' }}
              >
                Use the &quot;Going to Sleep&quot; button on the dashboard to start tracking.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, idx) => {
                const durationStyle = log.sleepDurationMinutes
                  ? getDurationStyle(log.sleepDurationMinutes)
                  : {};

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="p-4 rounded-xl flex items-center justify-between gap-4"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {/* Left: date + times */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Mood indicator */}
                      <div
                        className="w-10 h-10 flex-shrink-0 flex flex-col items-center justify-center rounded-lg text-xs font-semibold"
                        style={{
                          background: 'var(--elevated)',
                          border: '1px solid var(--border)',
                          color: getMoodColor(log.wakeUpMood),
                          fontFamily: 'var(--font-family-body)',
                        }}
                      >
                        {getMoodLabel(log.wakeUpMood)}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="font-medium text-sm truncate"
                          style={{ color: 'var(--text)' }}
                        >
                          {new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div
                          className="text-xs mt-0.5 flex gap-2"
                          style={{
                            color: 'var(--text-2)',
                            fontFamily: 'var(--font-family-mono)',
                          }}
                        >
                          <span>bed {log.sleepTime || '--:--'}</span>
                          <span style={{ color: 'var(--text-3)' }}>Â·</span>
                          <span>up {log.wakeUpTime || '--:--'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: duration */}
                    <div className="text-right flex-shrink-0">
                      {log.sleepDurationMinutes ? (
                        <>
                          <div
                            className="text-xl italic leading-none"
                            style={{
                              ...durationStyle,
                              fontFamily: 'var(--font-family-display)',
                            }}
                          >
                            {Math.floor(log.sleepDurationMinutes / 60)}h{' '}
                            {log.sleepDurationMinutes % 60}m
                          </div>
                          <div
                            className="text-xs mt-0.5"
                            style={{ color: 'var(--text-2)' }}
                          >
                            {log.sleepDurationMinutes >= 480
                              ? 'Target met'
                              : `${480 - log.sleepDurationMinutes}m short`}
                          </div>
                        </>
                      ) : (
                        <div
                          className="text-sm"
                          style={{ color: 'var(--text-2)' }}
                        >
                          In progress
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
