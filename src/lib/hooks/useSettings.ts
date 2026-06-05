import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskGoalLink } from '../types';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import { getLocalDateString } from '../date-utils';

// ============================================
// SETTINGS
// ============================================

export function useUserSettings() {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: ['user_settings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"

      return {
        id: data?.id,
        userId: data?.user_id,
        theme: data?.theme || 'dark', // Default
        dailySummaryTime: data?.daily_summary_time || '20:00', // Default
        enableDailySummaryReminder: data?.enable_daily_summary_reminder ?? true,
        // Map other fields as needed
        // Notification settings
        dailyMorningTime: data?.daily_morning_time || '07:00',
        enableMorningReminder: data?.enable_morning_reminder ?? true,
        enableTaskNotifications: data?.enable_task_notifications ?? true,
        enableGoalNotifications: data?.enable_goal_notifications ?? true,
        notificationOffsetMinutes: data?.notification_offset_minutes ?? 5,

        data: data // Keep raw data accessible if needed
      };
    },
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (updates: Record<string, any>) => {
      // Map frontend camelCase to snake_case DB fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUpdates: Record<string, any> = {};
      if (updates.dailySummaryTime !== undefined) dbUpdates.daily_summary_time = updates.dailySummaryTime;
      if (updates.enableDailySummaryReminder !== undefined) dbUpdates.enable_daily_summary_reminder = updates.enableDailySummaryReminder;
      if (updates.theme !== undefined) dbUpdates.theme = updates.theme;

      // New notification fields
      if (updates.dailyMorningTime !== undefined) dbUpdates.daily_morning_time = updates.dailyMorningTime;
      if (updates.enableMorningReminder !== undefined) dbUpdates.enable_morning_reminder = updates.enableMorningReminder;
      if (updates.enableTaskNotifications !== undefined) dbUpdates.enable_task_notifications = updates.enableTaskNotifications;
      if (updates.enableGoalNotifications !== undefined) dbUpdates.enable_goal_notifications = updates.enableGoalNotifications;
      if (updates.notificationOffsetMinutes !== undefined) dbUpdates.notification_offset_minutes = updates.notificationOffsetMinutes;

      // Upsert to handle creation if not exists
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          updated_at: new Date().toISOString(),
          ...dbUpdates
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
    },
  });
}

// ============================================
// WAKE UP / DAILY RESET
// ============================================

export function useResetDailyTasks() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: async () => {
      // BUG FIX: Build a UTC midnight timestamp that corresponds to the START of today
      // in local time, so the comparison against completed_at (UTC ISO) is correct.
      // Previously, setHours(0,0,0,0) produced local midnight, and .toISOString()
      // converted it to UTC — causing off-by-timezone-offset errors for UTC+/- users.
      // We now derive the local date string and reconstruct a UTC boundary accurately.
      const todayLocalStr = getLocalDateString(); // "YYYY-MM-DD" in local tz
      // Parse as local midnight explicitly
      const [year, month, day] = todayLocalStr.split('-').map(Number);
      const todayLocalMidnight = new Date(year, month - 1, day, 0, 0, 0, 0);

      const { error } = await supabase
        .from('tasks')
        .update({
          is_completed: false,
          completed_at: null,
          actual_minutes: null
        })
        .eq('user_id', userId)
        .eq('is_daily', true)
        .eq('is_completed', true)
        .lt('completed_at', todayLocalMidnight.toISOString());

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ============================================
// LINKS
// ============================================

export function useTaskGoalLinks() {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: ['task_goal_links', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_goal_links')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((link: any): TaskGoalLink => ({
        id: link.id,
        taskId: link.task_id,
        goalId: link.goal_id,
        contributionWeight: link.contribution_weight,
        createdAt: link.created_at,
      }));
    },
  });
}
