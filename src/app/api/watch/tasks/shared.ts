import type { SupabaseClient } from '@supabase/supabase-js';
import { USER_TZ } from '@/lib/health-server';

/**
 * Shared helpers for the watch task endpoints (PLAN.md B9).
 * "Today" must match what the notification cron and /api/notifications/ack use
 * (user_settings.timezone → USER_TIMEZONE), otherwise an ack from the watch
 * would land on a different acked_date than the one the cron checks.
 */
export async function userTimezone(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db.from('user_settings').select('timezone').eq('user_id', userId).maybeSingle();
  return (data?.timezone as string | undefined) || process.env.USER_TIMEZONE || USER_TZ;
}

export interface LocalNow {
  date: string; // YYYY-MM-DD
  minuteOfDay: number;
  dow: number; // 0 = Sunday (same as cron's repeat_days numbers)
  hhmm: string;
}

export function localNow(tz: string, now = new Date()): LocalNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const hh = Number(parts.hour) % 24; // some engines emit "24" at midnight
  const mm = Number(parts.minute);
  const dows: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now),
    minuteOfDay: hh * 60 + mm,
    dow: dows[parts.weekday] ?? now.getUTCDay(),
    hhmm: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
  };
}

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight, null if unparsable. */
export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export const fmtMinutes = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * repeat_days in notification_rules is an int[] of JS weekdays (0 = Sunday);
 * tolerate 'mon'-style strings too. Empty/null = every day.
 */
export function ruleRunsToday(repeatDays: unknown, dow: number): boolean {
  if (!Array.isArray(repeatDays) || repeatDays.length === 0) return true;
  const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return repeatDays.some((d) =>
    typeof d === 'number' ? d === dow : String(d).toLowerCase().slice(0, 3) === names[dow] || Number(d) === dow
  );
}
