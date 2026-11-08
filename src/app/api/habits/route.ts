import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { USER_TZ, localToday } from '@/lib/health-server';
import { adjustedCompletion, expectedFromCapacity, illnessAwareStreak } from '@/lib/health-scoring';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
  const userId = getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'User not configured' }, { status: 401 });
  }

  const [habitsResult, completionsResult] = await Promise.all([
    supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('habit_completions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(200),
  ]);

  if (habitsResult.error) {
    return NextResponse.json({ error: habitsResult.error.message }, { status: 500 });
  }

  if (completionsResult.error) {
    return NextResponse.json({ error: completionsResult.error.message }, { status: 500 });
  }

  const habits = habitsResult.data || [];
  const completions = completionsResult.data || [];
  const today = localToday();
  const health = await loadHealthContext(userId, today);

  // Illness-aware streaks per habit (PLAN.md B5). Illness days and days the
  // habit isn't scheduled are frozen: they neither break nor extend.
  const toLocalDate = (ts: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: USER_TZ }).format(new Date(ts));
  const doneByHabit = new Map<string, Set<string>>();
  for (const c of completions as { habit_id: string; completed_at: string; skipped?: boolean }[]) {
    if (c.skipped) continue;
    if (!doneByHabit.has(c.habit_id)) doneByHabit.set(c.habit_id, new Set());
    doneByHabit.get(c.habit_id)!.add(toLocalDate(c.completed_at));
  }
  const healthStreaks: Record<string, { current_streak: number; longest_streak: number; frozen_days: number }> = {};
  let dueToday = 0;
  let doneToday = 0;
  for (const h of habits as { id: string; target_days?: number[] | null }[]) {
    const done = doneByHabit.get(h.id) ?? new Set<string>();
    const frozen = new Set(health.illnessDates);
    const earliest = [...done].sort()[0];
    if (earliest && Array.isArray(h.target_days) && h.target_days.length > 0 && h.target_days.length < 7) {
      // target_days uses ISO weekdays (1 = Mon … 7 = Sun)
      for (let d = earliest; d <= today; d = nextDay(d)) {
        if (!h.target_days.includes(isoWeekday(d))) frozen.add(d);
      }
    }
    healthStreaks[h.id] = illnessAwareStreak(done, frozen, today);
    const scheduledToday = !Array.isArray(h.target_days) || h.target_days.length === 0 || h.target_days.includes(isoWeekday(today));
    if (scheduledToday) {
      dueToday++;
      if (done.has(today)) doneToday++;
    }
  }

  // Capacity-weighted completion for today
  const completion = dueToday > 0 ? doneToday / dueToday : 0;
  const expected = expectedFromCapacity(health.capacityHours);

  return NextResponse.json({
    habits,
    completions,
    // New (B5) fields — existing fields above are unchanged
    health_streaks: healthStreaks,
    today: {
      date: today,
      due: dueToday,
      done: doneToday,
      completion: Math.round(completion * 1000) / 1000,
      expected,
      adjusted_score: adjustedCompletion(completion, expected),
      capacity_hours: health.capacityHours,
      illness_flag: health.illnessDates.includes(today),
    },
  });
  } catch (error) {
    console.error('[Habits API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isoWeekday(date: string): number {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Illness days (last ~year) and today's capacity from health_day. Never throws. */
async function loadHealthContext(userId: string, today: string): Promise<{ illnessDates: string[]; capacityHours: number | null }> {
  try {
    const since = new Date(`${today}T12:00:00Z`);
    since.setUTCDate(since.getUTCDate() - 400);
    const [ill, todayRow] = await Promise.all([
      supabase.from('health_day').select('date').eq('user_id', userId).eq('illness_flag', true)
        .gte('date', since.toISOString().slice(0, 10)).lte('date', today),
      supabase.from('health_day').select('capacity_hours').eq('user_id', userId).eq('date', today).maybeSingle(),
    ]);
    return {
      illnessDates: (ill.data || []).map((r: { date: string }) => r.date),
      capacityHours: (todayRow.data as { capacity_hours: number | null } | null)?.capacity_hours ?? null,
    };
  } catch {
    return { illnessDates: [], capacityHours: null };
  }
}
