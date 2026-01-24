'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { WakeUpModal } from './sleep/WakeUpModal';
import { RoutineNotificationScheduler } from '@/lib/routineNotifications';
import { PushNotificationScheduler } from '@/lib/pushScheduler';

export function AppInitializer() {
  const [showWakeUpModal, setShowWakeUpModal] = useState(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    async function initializeApp() {
      const store = useAppStore.getState();
      
      console.log('[AppInit] Starting app initialization...');
      console.log('[AppInit] STEP 1: Loading data from cloud (Supabase)...');
      
      try {
        // CRITICAL: Load cloud data FIRST before any other operations
        // This ensures we always start with the latest data from Supabase
        const result = await store.loadFromCloud();
        
        if (!result.success) {
          console.error('[AppInit] ✗ Cloud load failed:', result.error);
          setLoadError(result.error || 'Failed to load data from cloud');
        } else {
          console.log('[AppInit] ✓ Cloud data loaded successfully');
        }
      } catch (err) {
        console.error('[AppInit] ✗ Cloud load exception:', err);
        setLoadError(String(err));
      }
      
      if (!isMounted) return;
      
      setIsCloudLoaded(true);
      
      console.log('[AppInit] STEP 2: Initializing app features...');
      
      // Now that cloud data is loaded, proceed with other initialization
      store.initializeDefaultTimeSlots();
      
      // ============================================
      // CRITICAL: Check if we need to reset daily tasks
      // This runs EVERY time the app loads, not just on wake-up popup
      // ============================================
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Check if any daily tasks were completed on a PREVIOUS day
      const tasksNeedingReset = store.tasks.filter(t => {
        if (!t.isDaily || !t.isCompleted || !t.completedAt) return false;
        const completedDate = t.completedAt.split('T')[0];
        return completedDate !== today; // Completed on a different day
      });
      
      if (tasksNeedingReset.length > 0) {
        console.log(`[AppInit] ⚠️ Found ${tasksNeedingReset.length} daily tasks from previous days - resetting...`);
        await store.resetDailyTasks();
        console.log('[AppInit] ✓ Daily tasks reset for new day');
      } else {
        console.log('[AppInit] ✓ No daily tasks needing reset');
      }
      
      // Check if should show wake-up modal (4+ hour gap since last interaction)
      // SKIP on landing page and /diary routes
      const isLandingPage = window.location.pathname === '/';
      const isDiaryRoute = window.location.pathname.startsWith('/diary');
      
      const lastOpen = store.lastAppOpen;
      const fourHoursMs = 4 * 60 * 60 * 1000;
      
      // Show popup if: not on landing/diary, 4+ hours since last open, and no wake-up recorded today
      if (!isLandingPage && !isDiaryRoute && (!lastOpen || (now.getTime() - new Date(lastOpen).getTime()) > fourHoursMs)) {
        // Check if we haven't already recorded wake-up today
        const todayLog = store.sleepWakeLogs.find(log => log.date === today);
        
        if (!todayLog?.wakeUpTime) {
          setShowWakeUpModal(true);
        }
      }
      
      // Track app open and interaction
      store.trackAppOpen();
      store.trackInteraction();
      
      console.log('[AppInit] ✓ App initialization complete');
    }
    
    initializeApp();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  return (
    <>
      {loadError && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-3 text-center z-50">
          ⚠️ Failed to load data from cloud: {loadError}
        </div>
      )}
      {showWakeUpModal && isCloudLoaded && (
        <WakeUpModal onClose={() => setShowWakeUpModal(false)} />
      )}
      <RoutineNotificationScheduler />
      <PushNotificationScheduler />
    </>
  );
}
