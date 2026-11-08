import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/user';
import { isPinValid } from '@/lib/garmin';
import { correlate } from '@/lib/health';
import { getHealthDays } from '@/lib/health-server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET (header x-site-pin) → today's processed health + 30-day history.
 * ?correlations=1 adds behaviour → outcome findings (A7).
 */
export async function GET(request: NextRequest) {
  if (!isPinValid(request.headers.get('x-site-pin'))) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }
  const userId = getCurrentUserId();
  const wantCorr = request.nextUrl.searchParams.get('correlations') === '1';
  const days = await getHealthDays(userId, wantCorr ? 90 : 31);
  const today = days[days.length - 1] ?? null;

  let correlations = null;
  if (wantCorr && days.length >= 14) {
    const from = days[0].date;
    const db = getSupabaseAdmin();
    const [entries, statuses] = await Promise.all([
      db.from('daily_entries').select('date,mood,summary,wins,challenges').eq('user_id', userId).gte('date', from),
      db.from('daily_task_status').select('date,is_completed,minutes_spent').eq('user_id', userId).gte('date', from),
    ]);
    const ctx = new Map<string, { date: string; tasksPlanned: number; tasksCompleted: number; productiveMinutes: number | null; mood: number | null; diaryText: string }>();
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
    correlations = correlate(days, [...ctx.values()]).slice(0, 8);
  }

  return NextResponse.json({ today, history: days.slice(-31), correlations });
}
