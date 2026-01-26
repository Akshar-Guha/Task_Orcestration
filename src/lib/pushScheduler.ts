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
import { useTasks, useGoals, useUserSettings } from '@/lib/hooks/useSupabase';

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
// Morning reminder notification
export function useMorningReminderScheduler() {
  const { data: tasks = [] } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: settings } = useUserSettings();
  const focusGoalIds = useAppStore(state => state.focusGoalIds);
  
  useEffect(() => {
    if (!settings || settings.enableMorningReminder === false) return;

    // Parse configured time "HH:MM"
    const [h, m] = (settings.dailyMorningTime || '07:00').split(':').map(Number);
    
    const msUntilTimeTarget = msUntilTime(h || 7, m || 0);
    console.log(`[PushScheduler] Morning reminder scheduled for ${h}:${m} (in ${Math.round(msUntilTimeTarget / 60000)}m)`);
    
    const timeout = setTimeout(async () => {
      const todayTasks = tasks.filter(t => !t.isCompleted && !t.isArchived);
      const focusGoals = goals.filter(g => focusGoalIds.includes(g.id));
      
      const body = focusGoals.length > 0
        ? `Focus on: ${focusGoals[0].title}. ${todayTasks.length} tasks waiting.`
        : `You have ${todayTasks.length} tasks to tackle today. Let's go! 💪`;
      
      await sendPushNotification(
        '☀️ Good Morning!',
        body,
        '/dashboard'
      );
    }, msUntilTimeTarget);
    
    return () => clearTimeout(timeout);
  }, [tasks, goals, focusGoalIds, settings]);
}

// Diary reminder notification
function useDiaryReminderScheduler() {
  const { data: settings } = useUserSettings();

  useEffect(() => {
    if (!settings || settings.enableDailySummaryReminder === false) return;

    const [h, m] = (settings.dailySummaryTime || '20:00').split(':').map(Number);
    const msUntilTimeTarget = msUntilTime(h || 20, m || 0);
    
    console.log(`[PushScheduler] Diary reminder scheduled for ${h}:${m} (in ${Math.round(msUntilTimeTarget / 60000)}m)`);
    
    const timeout = setTimeout(async () => {
      // TODO: Check if diary entry exists for today via API
      const hasEntryToday = false; 
      
      if (!hasEntryToday) {
        await sendPushNotification(
          '📝 How was your day?',
          'Take a moment to reflect on your wins and challenges.',
          '/diary/new'
        );
      }
    }, msUntilTimeTarget);
    
    return () => clearTimeout(timeout);
  }, [settings]);
}

// Task completion celebration
export function sendTaskCompletionNotification(taskTitle: string) {
  // We can't easily check settings here without a hook, 
  // but immediate feedback is usually desired if push is enabled generally.
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
function useDeadlineScheduler() {
  const { data: goals = [] } = useGoals();
  const { data: settings } = useUserSettings();
  const oneDayMs = 24 * 60 * 60 * 1000;

  useEffect(() => {
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
  useMorningReminderScheduler();
  useDeadlineScheduler();
  useDiaryReminderScheduler();
}

// Component to enable push notification scheduling
export function PushNotificationScheduler() {
  usePushNotificationScheduler();
  return null;
}
