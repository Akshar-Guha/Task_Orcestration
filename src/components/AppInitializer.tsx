'use client';

import { useEffect, useState } from 'react';
import { WakeUpModal } from './sleep/WakeUpModal';
import { RoutineNotificationScheduler } from '@/lib/routineNotifications';
import { PushNotificationScheduler } from '@/lib/pushScheduler';
import { useTasks, useResetDailyTasks, useSleepLogs, useTimeSlots } from '@/lib/hooks/useSupabase';

export function AppInitializer() {
  // State to track if we've already run the initialization check this session
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showWakeUpModal, setShowWakeUpModal] = useState(false);
  
  // Hooks for data
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: sleepLogs = [], isLoading: sleepLoading } = useSleepLogs();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: timeSlots = [] } = useTimeSlots();
  
  const resetDailyTasksMutation = useResetDailyTasks();

  // Initialization Logic
  useEffect(() => {
    // Only run if data is loaded and we haven't initialized yet
    if (tasksLoading || sleepLoading || hasInitialized) return;

    const init = async () => {
      // 1. Check for Daily Reset
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const tasksNeedingReset = tasks.filter(t => {
        if (!t.isDaily || !t.isCompleted || !t.completedAt) return false;
        const completedDate = t.completedAt.split('T')[0];
        return completedDate !== today;
      });
      
      if (tasksNeedingReset.length > 0) {
        console.log(`[AppInit] ⚠️ Found ${tasksNeedingReset.length} daily tasks from previous days - resetting...`);
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
           // Only show if strictly missing and not previously dismissed match
           setShowWakeUpModal(true);
        }
      }
      
      // Mark as initialized so we don't re-run this logic even if data refreshes (e.g. after mutation)
      setHasInitialized(true);
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
