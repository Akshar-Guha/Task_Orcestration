import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import type { TimeSlot } from '../types';
import { getLocalDateString } from '../date-utils';

// ============================================
// PRODUCTIVITY & ANALYTICS
// ============================================

export function useProductivity() {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: ['productivity', userId],
    queryFn: async () => {
      // BUG FIX: use local date string instead of UTC-based .toISOString().split('T')[0]
      const today = getLocalDateString();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = getLocalDateString(weekAgo);

      const { data, error } = await supabase
        .from('productivity_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', weekAgoStr);

      if (error) throw error;

      const logs = data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const todayLog = logs.find((l: any) => l.date === today);
      const productiveMinutes = todayLog?.productive_minutes || 0;

      // Calculate actual waking minutes from today's sleep log
      const { data: sleepLog } = await supabase
        .from('sleep_wake_logs')
        .select('wake_up_time')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      let totalWaking = 16 * 60; // Default fallback
      if (sleepLog?.wake_up_time) {
        const [wh, wm] = sleepLog.wake_up_time.split(':').map(Number);
        const wakeUpMins = wh * 60 + wm;
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        totalWaking = Math.max(1, currentMins - wakeUpMins);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const daysWithLogs = logs.filter((l: any) => l.productive_minutes > 0).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const weekMinutes = logs.reduce((sum: number, l: any) => sum + (l.productive_minutes || 0), 0);

      return {
        todayMinutes: productiveMinutes,
        todayPercentage: Math.min(100, Math.round((productiveMinutes / totalWaking) * 100)),
        totalWakingMinutes: totalWaking,
        weekMinutes,
        weeklyAverage: Math.round(weekMinutes / Math.max(1, daysWithLogs)),
        logs,
      };
    },
  });
}
