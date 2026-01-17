'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { WakeUpModal } from './sleep/WakeUpModal';
import { RoutineNotificationScheduler } from '@/lib/routineNotifications';

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
    </>
  );
}
