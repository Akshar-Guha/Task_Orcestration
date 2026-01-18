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

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

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

// Morning reminder notification
export function scheduleMorningReminder(onSend?: () => void) {
  const msUntil7AM = msUntilTime(7, 0);
  
  console.log(`[PushScheduler] Morning reminder scheduled in ${Math.round(msUntil7AM / 60000)} minutes`);
  
  return setTimeout(async () => {
    const store = useAppStore.getState();
    const todayTasks = store.tasks.filter(t => !t.isCompleted && !t.isArchived);
    const focusGoals = store.goals.filter(g => store.focusGoalIds.includes(g.id));
    
    const body = focusGoals.length > 0
      ? `Focus on: ${focusGoals[0].title}. ${todayTasks.length} tasks waiting.`
      : `You have ${todayTasks.length} tasks to tackle today. Let's go! 💪`;
    
    await sendPushNotification(
      '☀️ Good Morning!',
      body,
      '/dashboard'
    );
    
    onSend?.();
    
    // Reschedule for next day
    scheduleMorningReminder(onSend);
  }, msUntil7AM);
}

// Diary reminder notification (8 PM)
export function scheduleDiaryReminder(onSend?: () => void) {
  const msUntil8PM = msUntilTime(20, 0);
  
  console.log(`[PushScheduler] Diary reminder scheduled in ${Math.round(msUntil8PM / 60000)} minutes`);
  
  return setTimeout(async () => {
    // Check if diary entry exists for today
    // Note: This requires diary entries to be loaded in the future
    const hasEntryToday = false; // TODO: Check from API
    
    if (!hasEntryToday) {
      await sendPushNotification(
        '📝 How was your day?',
        'Take a moment to reflect on your wins and challenges.',
        '/diary/new'
      );
    }
    
    onSend?.();
    
    // Reschedule for next day
    scheduleDiaryReminder(onSend);
  }, msUntil8PM);
}

// Task completion celebration
export function sendTaskCompletionNotification(taskTitle: string) {
  const celebrations = [
    '🎉 Task completed!',
    '✅ Nice work!',
    '🌟 You did it!',
    '💪 Keep crushing it!',
    '🚀 One step closer!'
  ];
  
  const title = celebrations[Math.floor(Math.random() * celebrations.length)];
  
  return sendPushNotification(
    title,
    `Finished: ${taskTitle}`,
    '/dashboard'
  );
}

// Goal deadline approaching (check daily)
export function checkGoalDeadlines() {
  const store = useAppStore.getState();
  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  store.goals
    .filter(g => !g.isArchived && g.status !== 'completed')
    .forEach(goal => {
      // Check if goal has a deadline in metadata
      const metadata = goal.metadata as Record<string, unknown> | undefined;
      const deadline = metadata?.deadline as string | undefined;
      
      if (deadline) {
        const deadlineDate = new Date(deadline);
        const timeUntil = deadlineDate.getTime() - now.getTime();
        
        // If deadline is within 24 hours
        if (timeUntil > 0 && timeUntil <= oneDayMs) {
          sendPushNotification(
            '⏰ Deadline Approaching!',
            `"${goal.title}" is due tomorrow.`,
            '/goals'
          );
        }
      }
    });
}

// React hook to manage all scheduled notifications
export function usePushNotificationScheduler() {
  const morningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const diaryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deadlineIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Schedule morning reminder
    morningTimeoutRef.current = scheduleMorningReminder();
    
    // Schedule diary reminder
    diaryTimeoutRef.current = scheduleDiaryReminder();
    
    // Check goal deadlines every 6 hours
    checkGoalDeadlines(); // Check immediately
    deadlineIntervalRef.current = setInterval(checkGoalDeadlines, 6 * 60 * 60 * 1000);
    
    console.log('[PushScheduler] All notifications scheduled');
    
    return () => {
      if (morningTimeoutRef.current) clearTimeout(morningTimeoutRef.current);
      if (diaryTimeoutRef.current) clearTimeout(diaryTimeoutRef.current);
      if (deadlineIntervalRef.current) clearInterval(deadlineIntervalRef.current);
    };
  }, []);
}

// Component to enable push notification scheduling
export function PushNotificationScheduler() {
  usePushNotificationScheduler();
  return null;
}
