'use client';

import { useEffect, useState } from 'react';
import { WakeUpModal } from './sleep/WakeUpModal';
import { RoutineNotificationScheduler } from '@/lib/routineNotifications';
import { PushNotificationScheduler } from '@/lib/pushScheduler';
import { useTasks, useResetDailyTasks, useSleepLogs, useTimeSlots } from '@/lib/hooks/useSupabase';

export function AppInitializer() {
  const [showWakeUpModal, setShowWakeUpModal] = useState(false);
  
  // Hooks for data
  const { data: tasks = [] } = useTasks();
  const { data: sleepLogs = [] } = useSleepLogs();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: timeSlots = [] } = useTimeSlots();
  
  const resetDailyTasksMutation = useResetDailyTasks();

  // Initialization Logic
  useEffect(() => {
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
      
      if (!isLandingPage && !isDiaryRoute) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const todayLog = sleepLogs.find((log: any) => log.date === today);
        if (!todayLog?.wakeUpTime) {
          setShowWakeUpModal(true);
        }
      }
      
      // 3. Initialize Default Time Slots if empty
      // Only run this if we are sure data is loaded (which useTimeSlots handles, but we need to be careful not to spam)
      // For now, skipping auto-creation to avoid duplicates if query is slow. 
      // If needed, we can check if timeSlots is explicitly empty array AND query status is success.
    };

    if (tasks.length > 0 || sleepLogs.length > 0) {
       init();
    }
  }, [tasks, sleepLogs, resetDailyTasksMutation]);

  return (
    <>
      {showWakeUpModal && (
        <WakeUpModal onClose={() => setShowWakeUpModal(false)} />
      )}
      <RoutineNotificationScheduler />
      <PushNotificationScheduler />
    </>
  );
}
