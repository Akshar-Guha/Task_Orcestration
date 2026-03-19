'use client';

/**
 * Routine Notification Service
 * 
 * Schedules notifications at the end of each time slot (routine) to show
 * a summary of tasks completed during that period.
 */

import { useEffect, useRef } from 'react';
import { useGoals, useTasks, useTimeSlots, useUserSettings } from '@/lib/hooks/useSupabase';
import type { TimeSlot, Goal, Task } from '@/lib/types';

// Check if browser notifications are supported
const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  
  if (Notification.permission === 'granted') return true;
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

// Show a notification
function showNotification(title: string, body: string, icon?: string) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    console.log('[Notification]', title, body);
    return;
  }
  
  try {
    new Notification(title, {
      body,
      icon: icon || '/icons/icon-192x192.png',
      tag: 'routine-summary',
    });
  } catch (err) {
    console.error('[Notification] Error showing notification:', err);
  }
}

// Parse time string "HH:MM" to minutes since midnight
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Get current time in minutes since midnight
function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Calculate time until next slot end (in ms)
function msUntilSlotEnd(slot: TimeSlot): number {
  const currentMinutes = getCurrentTimeMinutes();
  const endMinutes = parseTimeToMinutes(slot.endTime);
  
  let minutesUntilEnd = endMinutes - currentMinutes;
  
  // If end time has passed today, schedule for tomorrow
  if (minutesUntilEnd <= 0) {
    minutesUntilEnd += 24 * 60;
  }
  
  return minutesUntilEnd * 60 * 1000;
}

// Generate summary for a time slot
function generateRoutineSummary(slot: TimeSlot, goals: Goal[], tasks: Task[]): string {
  const slotGoals = goals.filter(g => slot.goalIds.includes(g.id));
  const slotTasks = tasks.filter(t => slotGoals.some(g => g.id === t.goalId));
  const completed = slotTasks.filter(t => t.isCompleted);
  const totalMinutes = completed.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  
  if (completed.length === 0) {
    return `0 tasks completed during ${slot.name}`;
  }
  
  return `${completed.length}/${slotTasks.length} tasks ✓ • ${totalMinutes}m productive`;
}

/**
 * Hook to schedule routine notifications
 */
export function useRoutineNotifications() {
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Use React Query hooks instead of safe store access
  const { data: timeSlots = [] } = useTimeSlots();
  const { data: goals = [] } = useGoals();
  const { data: tasks = [] } = useTasks();
  const { data: userSettings } = useUserSettings();
  
  useEffect(() => {
    // Check if notifications are enabled
    if (!userSettings?.enableDailySummaryReminder) {
      return;
    }
    
    // Request permission if not already granted
    requestNotificationPermission();
    
    // Clear existing timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    
    // Schedule notification for each active time slot
    timeSlots.filter(slot => slot.isActive).forEach(slot => {
      const msUntil = msUntilSlotEnd(slot);
      
      // Only schedule if less than 24 hours away
      if (msUntil < 24 * 60 * 60 * 1000) {
        const timeout = setTimeout(() => {
          // Use the data captured partly in closure, but ideally we'd refetch or use refs
          // For simplicity/reliability in this effect-based scheduler, we use the latest props from the render cycle
          // warning: this might use "stale" data captured at effect time if dependencies don't update.
          // However, since we add them to dep array, it will reschedule when data changes.
          
          const summary = generateRoutineSummary(slot, goals, tasks);
          
          showNotification(
            `${slot.name} Complete 🎯`,
            summary
          );
          
        }, msUntil);
        
        timeoutsRef.current.set(slot.id, timeout);
        console.log(`[Notifications] Scheduled ${slot.name} notification in ${Math.round(msUntil / 60000)}min`);
      }
    });
    
    // Copy ref for cleanup
    const currentTimeouts = timeoutsRef.current;
    
    // Cleanup on unmount
    return () => {
      currentTimeouts.forEach(timeout => clearTimeout(timeout));
      currentTimeouts.clear();
    };
  }, [timeSlots, goals, tasks, userSettings]); // Re-schedule when data changes
}

/**
 * Component wrapper to enable routine notifications
 */
export function RoutineNotificationScheduler() {
  useRoutineNotifications();
  return null;
}
