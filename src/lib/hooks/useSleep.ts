import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import type { SleepWakeLog, MoodLevel } from '../types';
import { calculateSleepDuration, getYesterdayDateStr, getLocalDateString } from '../date-utils';

// ============================================
// SLEEP / WAKE
// ============================================

export function useSleepLogs() {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: ['sleep_logs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sleep_wake_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7);

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((log: any): SleepWakeLog => ({
        id: log.id,
        date: log.date,
        wakeUpTime: log.wake_up_time,
        wakeUpConfirmedAt: log.wake_up_confirmed_at,
        wakeUpMood: log.wake_up_mood,
        sleepTime: log.sleep_time,
        sleepAttempts: log.sleep_attempts || [],
        sleepDurationMinutes: log.sleep_duration_minutes,
        notes: log.notes,
        createdAt: log.created_at,
        updatedAt: log.updated_at,
      }));
    },
  });
}

export function useRecordWakeUp() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: async ({ adjustedMinutes, mood }: { adjustedMinutes: number, mood: MoodLevel }) => {
      // BUG FIX: use local date string instead of UTC-based .toISOString().split('T')[0]
      const today = getLocalDateString();
      const now = new Date();
      now.setMinutes(now.getMinutes() - adjustedMinutes);
      const wakeUpTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('sleep_wake_logs')
        .upsert({
          user_id: userId,
          date: today,
          wake_up_time: wakeUpTime,
          wake_up_mood: mood,
          wake_up_confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'date,user_id' })
        .select()
        .single();

      if (error) throw error;

      // Calculate sleep duration from previous day's sleep log
      const yesterday = getYesterdayDateStr();
      const { data: yesterdayLog } = await supabase
        .from('sleep_wake_logs')
        .select('sleep_time, sleep_duration_minutes')
        .eq('user_id', userId)
        .eq('date', yesterday)
        .single();

      if (yesterdayLog?.sleep_time && !yesterdayLog.sleep_duration_minutes) {
        const duration = calculateSleepDuration(yesterdayLog.sleep_time, wakeUpTime);
        // Update yesterday's log with calculated duration
        await supabase
          .from('sleep_wake_logs')
          .update({
            sleep_duration_minutes: duration,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('date', yesterday);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep_logs'] });
    }
  });
}

export function useRecordSleep() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: async () => {
      // BUG FIX: use local date string instead of UTC-based .toISOString().split('T')[0]
      const today = getLocalDateString();
      const now = new Date();
      const sleepTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // 1. Get existing log to append attempt
      const { data: existing } = await supabase
        .from('sleep_wake_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      const sleepAttempts = existing?.sleep_attempts || [];
      sleepAttempts.push(new Date().toISOString());

      const { data, error } = await supabase
        .from('sleep_wake_logs')
        .upsert({
          user_id: userId,
          date: today,
          sleep_time: sleepTime,
          sleep_attempts: sleepAttempts,
          updated_at: new Date().toISOString()
        }, { onConflict: 'date,user_id' })
        .select()
        .single();

      if (error) throw error;

      // Trigger email
      // Email trigger removed as per user request (Scheduled only)

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep_logs'] });
    }
  });
}
