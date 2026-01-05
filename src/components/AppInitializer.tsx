'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { WakeUpModal } from './sleep/WakeUpModal';

export function AppInitializer() {
  const [showWakeUpModal, setShowWakeUpModal] = useState(false);

  useEffect(() => {
    const store = useAppStore.getState();
    
    // Initialize Life Routines if not already done
    store.initializeLifeRoutines();
    
    // Check if should show wake-up modal (4+ hour gap since last interaction)
    const now = new Date();
    const lastOpen = store.lastAppOpen;
    const fourHoursMs = 4 * 60 * 60 * 1000;
    
    if (!lastOpen || (now.getTime() - new Date(lastOpen).getTime()) > fourHoursMs) {
      // Check if we haven't already recorded wake-up today
      const today = now.toISOString().split('T')[0];
      const todayLog = store.sleepWakeLogs.find(log => log.date === today);
      
      if (!todayLog?.wakeUpTime) {
        setShowWakeUpModal(true);
      }
    }
    
    // Track app open & detect wake-up
    store.trackAppOpen();
    
    // Auto-reset daily tasks if needed
    const today = new Date().toISOString().split('T')[0];
    const hasTasksToday = store.dailyTaskInstances.some((t) => t.date === today);
    
    if (!hasTasksToday && store.routineTemplates.length > 0) {
      store.resetDailyTasks();
    }
    
    // Track interaction
    store.trackInteraction();
  }, []);
  
  return (
    <>
      {showWakeUpModal && (
        <WakeUpModal onClose={() => setShowWakeUpModal(false)} />
      )}
    </>
  );
}
