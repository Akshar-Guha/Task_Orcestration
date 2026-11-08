import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import { getLocalDateString } from '../date-utils';
import type { HealthDay } from '../health/types';

// ============================================
// HEALTH (health_day, read-only from the browser via RLS)
// ============================================

export type HealthDayRow = HealthDay & { user_id: string };

/** One health_day row for a local date (YYYY-MM-DD); null when none exists. */
export function useHealthDay(date: string | null | undefined) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: ['health_day', userId, date],
    enabled: !!userId && !!date,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<HealthDayRow | null> => {
      const { data, error } = await supabase
        .from('health_day')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date!)
        .maybeSingle();
      if (error) throw error;
      return (data as HealthDayRow | null) ?? null;
    },
  });
}

/** The last `n` days of health_day rows (oldest first), ending today. */
export function useHealthDays(n: number = 30) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: ['health_days', userId, n],
    enabled: !!userId && n > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<HealthDayRow[]> => {
      const from = new Date();
      from.setDate(from.getDate() - (n - 1));
      const { data, error } = await supabase
        .from('health_day')
        .select('*')
        .eq('user_id', userId)
        .gte('date', getLocalDateString(from))
        .order('date', { ascending: true });
      if (error) throw error;
      return (data as HealthDayRow[] | null) ?? [];
    },
  });
}
