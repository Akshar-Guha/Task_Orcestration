'use client';

import { useEffect, useState, useRef } from 'react';
import { WakeUpModal } from './sleep/WakeUpModal';
import { RoutineNotificationScheduler } from '@/lib/routineNotifications';
import { PushNotificationScheduler } from '@/lib/pushScheduler';
import { useTasks, useResetDailyTasks, useSleepLogs, useTimeSlots } from '@/lib/hooks/useSupabase';

export function AppInitializer() {
  // State to track if we've already run the initialization check this session
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showWakeUpModal, setShowWakeUpModal] = useState(false);
  // Ref-based guard to prevent race conditions (synchronous lock)
  const initRef = useRef(false);

  // Hooks for data
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: sleepLogs = [], isLoading: sleepLoading } = useSleepLogs();
  useTimeSlots(); // Pre-fetch time slots for downstream components

  const resetDailyTasksMutation = useResetDailyTasks();

  // Initialization Logic
  useEffect(() => {
    // Only run if data is loaded and we haven't initialized yet
    if (tasksLoading || sleepLoading || hasInitialized) return;
    // Synchronous guard to prevent double-execution on fast re-renders
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        // 1. Check for Daily Reset
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        const tasksNeedingReset = tasks.filter(t => {
          if (!t.isDaily || !t.isCompleted || !t.completedAt) return false;
          const completedDate = t.completedAt.split('T')[0];
          return completedDate !== today;
        });

        if (tasksNeedingReset.length > 0) {
          console.log(`[AppInit] Found ${tasksNeedingReset.length} daily tasks from previous days - resetting...`);
          resetDailyTasksMutation.mutate();
        }

        // 2. Wake Up Modal Check
        const isLandingPage = window.location.pathname === '/';
        const isDiaryRoute = window.location.pathname.startsWith('/diary');

        // Check if user already dismissed it today
        const dismissedKey = `mto_wake_dismissed_${today}`;
        const isDismissed = localStorage.getItem(dismissedKey) === 'true';

        if (!isLandingPage && !isDiaryRoute && !isDismissed) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const todayLog = sleepLogs.find((log: any) => log.date === today);
          if (!todayLog?.wakeUpTime) {
            setShowWakeUpModal(true);
          }
        }

        // Mark as initialized so we don't re-run this logic even if data refreshes
        setHasInitialized(true);
      } catch (err) {
        console.error('[AppInit] Initialization error:', err);
        // Reset the ref so a future render can retry
        initRef.current = false;
      }
    };

    init();
  }, [tasks, sleepLogs, tasksLoading, sleepLoading, hasInitialized, resetDailyTasksMutation]);

  const handleCloseModal = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`mto_wake_dismissed_${today}`, 'true');
    setShowWakeUpModal(false);
  };

  return (
    <>
      {showWakeUpModal && (
        <WakeUpModal onClose={handleCloseModal} />
      )}
      <RoutineNotificationScheduler />
      <PushNotificationScheduler />
    </>
  );
}
