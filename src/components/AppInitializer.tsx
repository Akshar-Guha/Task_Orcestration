'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export function AppInitializer() {
  useEffect(() => {
    const store = useAppStore.getState();
    
    // Initialize Life Routines if not already done
    store.initializeLifeRoutines();
    
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
  
  return null;
}
