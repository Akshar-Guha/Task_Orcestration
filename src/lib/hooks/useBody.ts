'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getCurrentUserId } from '../user';
import { calculateSleepDuration, getLocalDateString } from '../date-utils';
import { addDays, correlate, type DayContext, type HealthDay } from '../health';

/** Processed health days (oldest → newest), from the Garmin/watch pipeline. */
export function useBodyDays(days = 31) {
  const userId = getCurrentUserId();
  return useQuery({
    queryKey: ['health_day', userId, days],
    queryFn: async (): Promise<HealthDay[]> => {
      const { data, error } = await supabase
        .from('health_day')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(days);
      if (error) throw error;
      return ((data ?? []) as HealthDay[]).reverse();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Today's processed row (null if the watch hasn't synced today). */
export function useBodyToday() {
  const q = useBodyDays(31);
  const today = getLocalDateString();
  const days = q.data ?? [];
  const row = days.find((d) => d.date === today) ?? null;
  return { ...q, today: row, days, hasWatch: days.some((d) => d.sources && (d.sources as unknown as string[]).length > 0) };
}

/** Mood is the one thing the watch can't know — one tap, nothing else. */
export function useRecordMood() {
  const qc = useQueryClient();
  const userId = getCurrentUserId();
  return useMutation({
    mutationFn: async (mood: number) => {
      const { error } = await supabase
        .from('sleep_wake_logs')
        .upsert(
          { user_id: userId, date: getLocalDateString(), wake_up_mood: mood, updated_at: new Date().toISOString() },
          { onConflict: 'date,user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sleep_logs'] }),
  });
}

/** "Correct this": manual override that the Garmin sync will not overwrite. */
export function useSleepOverride() {
  const qc = useQueryClient();
  const userId = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ bed, wake }: { bed: string; wake: string }) => {
      const today = getLocalDateString();
      // Bedtime after noon belongs to yesterday's evening; early-morning bedtime to today's night row of yesterday too
      const night = addDays(today, -1);
      const now = new Date().toISOString();
      const duration = calculateSleepDuration(bed, wake);
      const a = await supabase.from('sleep_wake_logs').upsert(
        { user_id: userId, date: night, sleep_time: bed, sleep_duration_minutes: duration, sleep_source: 'manual_override', updated_at: now },
        { onConflict: 'date,user_id' }
      );
      if (a.error) throw a.error;
      const b = await supabase.from('sleep_wake_logs').upsert(
        { user_id: userId, date: today, wake_up_time: wake, wake_source: 'manual_override', updated_at: now },
        { onConflict: 'date,user_id' }
      );
      if (b.error) throw b.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sleep_logs'] }),
  });
}

/** Behaviour → next-day outcome findings computed in the browser from the user's own data. */
export function useBodyPatterns(days: HealthDay[]) {
  const userId = getCurrentUserId();
  const from = days[0]?.date;
  return useQuery({
    queryKey: ['body_patterns', userId, from, days.length],
    enabled: days.length >= 14 && !!from,
    queryFn: async () => {
      const [entries, statuses] = await Promise.all([
        supabase.from('daily_entries').select('date,mood,summary,wins,challenges').eq('user_id', userId).gte('date', from),
        supabase.from('daily_task_status').select('date,is_completed,minutes_spent').eq('user_id', userId).gte('date', from),
      ]);
      const ctx = new Map<string, DayContext>();
      const get = (date: string) => {
        if (!ctx.has(date)) ctx.set(date, { date, tasksPlanned: 0, tasksCompleted: 0, productiveMinutes: null, mood: null, diaryText: '' });
        return ctx.get(date)!;
      };
      for (const s of statuses.data ?? []) {
        const c = get(s.date);
        c.tasksPlanned += 1;
        if (s.is_completed) c.tasksCompleted += 1;
        c.productiveMinutes = (c.productiveMinutes ?? 0) + (s.minutes_spent ?? 0);
      }
      for (const e of entries.data ?? []) {
        const c = get(e.date);
        c.mood = e.mood;
        c.diaryText = [e.summary, ...(e.wins ?? []), ...(e.challenges ?? [])].filter(Boolean).join(' ');
      }
      return correlate(days, [...ctx.values()]).slice(0, 6);
    },
    staleTime: 30 * 60 * 1000,
  });
}
