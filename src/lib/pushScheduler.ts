/**
 * Push Notification Scheduler
 * 
 * Handles scheduled push notifications for:
 * 1. Morning reminder (7 AM daily)
 * 2. Goal deadline approaching (1 day before)
 * 3. Task completion celebration
 * 4. Diary reminder (evening)
 */

'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store'; // Keep for focusGoalIds
import { useGoals, useUserSettings, useTimeSlots } from '@/lib/hooks/useSupabase';

const PUSH_API_URL = '/api/push/send';

// Send push notification via API
async function sendPushNotification(title: string, body: string, url?: string) {
  try {
    const response = await fetch(PUSH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url })
    });
    
    if (!response.ok) {
      console.error('[PushScheduler] Failed to send notification:', await response.text());
      return false;
    }
    
    const result = await response.json();
    console.log('[PushScheduler] Notification sent:', result);
    return result.success;
  } catch (error) {
    console.error('[PushScheduler] Error sending notification:', error);
    return false;
  }
}

// Calculate ms until a specific time today (or tomorrow if passed)
function msUntilTime(hours: number, minutes: number = 0): number {
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  
  let diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    // Time has passed today, schedule for tomorrow
    diff += 24 * 60 * 60 * 1000;
  }
  return diff;
}

// Dynamic Time Slot Scheduler
function useTimeSlotScheduler() {
  const { data: timeSlots = [] } = useTimeSlots();
  const { data: settings } = useUserSettings();

  useEffect(() => {
    // If settings disable daily reminders, maybe we disable this too? 
    // Or we consider this "Task Notifications".
    if (!settings || settings.enableTaskNotifications === false) return;

    const timeouts: NodeJS.Timeout[] = [];

    timeSlots.forEach((slot: { isActive: boolean; startTime: string; name: string }) => {
      if (!slot.isActive) return;

      const [h, m] = slot.startTime.split(':').map(Number);
      const msUntil = msUntilTime(h, m);
      
      console.log(`[PushScheduler] Scheduling "${slot.name}" for ${slot.startTime} (in ${Math.round(msUntil / 60000)}m)`);
      
      const timeout = setTimeout(async () => {
         await sendPushNotification(
            `👉 Time for ${slot.name}`,
            `Routine starting: ${slot.name}. Check your goals!`,
            '/dashboard'
         );
      }, msUntil);

      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [timeSlots, settings]);
}


// Goal deadline approaching (check daily)
function useDeadlineScheduler() {
  const { data: goals = [] } = useGoals();
  const { data: settings } = useUserSettings();

  useEffect(() => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (!settings || settings.enableGoalNotifications === false) return;

    const checkDeadlines = () => {
      const now = new Date();
      goals
        .filter(g => !g.isArchived && g.status !== 'completed')
        .forEach(goal => {
          const metadata = goal.metadata as Record<string, unknown> | undefined;
          const deadline = metadata?.deadline as string | undefined;
          
          if (deadline) {
            const deadlineDate = new Date(deadline);
            const timeUntil = deadlineDate.getTime() - now.getTime();
            
            if (timeUntil > 0 && timeUntil <= oneDayMs) {
              sendPushNotification(
                '⏰ Deadline Approaching!',
                `"${goal.title}" is due tomorrow.`,
                '/goals'
              );
            }
          }
        });
    };

    checkDeadlines();
    const interval = setInterval(checkDeadlines, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [goals, settings]);
}

// React hook to manage all scheduled notifications
export function usePushNotificationScheduler() {
  // Use specialized hooks
  // Replaced static morning/diary with dynamic slots as requested
  useTimeSlotScheduler(); 
  useDeadlineScheduler();
}

// Component to enable push notification scheduling
export function PushNotificationScheduler() {
  usePushNotificationScheduler();
  return null;
}
