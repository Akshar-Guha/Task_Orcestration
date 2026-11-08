/**
 * Server side of the health pipeline (PLAN.md B1/B2).
 * Loads raw feeds + app context, runs the pure engine in src/lib/health,
 * writes health_day, and syncs derived data into existing app tables so the
 * user never types what the watch already knows.
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  addDays,
  buildHealthDay,
  hhmm,
  summaryDate,
  tzOffsetSeconds,
  type DayContext,
  type GarminSummary,
  type HealthDay,
  type RawDay,
} from '@/lib/health';

export const USER_TZ = process.env.USER_TIMEZONE || 'Asia/Kolkata';

const SUMMARY_KEYS: Record<string, keyof Omit<RawDay, 'date' | 'watchDaily' | 'watchSamples'>> = {
  dailies: 'dailies',
  sleeps: 'sleeps',
  hrv: 'hrv',
  stressDetails: 'stressDetails',
  pulseox: 'pulseox',
  allDayRespiration: 'respiration',
  respiration: 'respiration',
  userMetrics: 'userMetrics',
  activities: 'activities',
  epochs: 'epochs',
};

export function localToday(tz = USER_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

const offsetFor = (date: string) => tzOffsetSeconds(USER_TZ, new Date(`${date}T12:00:00Z`));

/** Page through a Supabase query (PostgREST caps at 1000 rows). */
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(String((error as { message?: string }).message ?? error));
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function loadContext(userId: string, from: string, to: string): Promise<Map<string, DayContext>> {
  const db = getSupabaseAdmin();
  const [statuses, dailyTasks, entries, prod] = await Promise.all([
    all<{ date: string; is_completed: boolean; minutes_spent: number | null }>((a, b) =>
      db.from('daily_task_status').select('date,is_completed,minutes_spent').eq('user_id', userId).gte('date', from).lte('date', to).range(a, b)
    ),
    db.from('tasks').select('id').eq('user_id', userId).eq('is_daily', true).eq('is_archived', false),
    all<{ date: string; mood: number | null; summary: string | null; wins: string[] | null; challenges: string[] | null }>((a, b) =>
      db.from('daily_entries').select('date,mood,summary,wins,challenges').eq('user_id', userId).gte('date', from).lte('date', to).range(a, b)
    ),
    all<{ date: string; productive_minutes: number | null }>((a, b) =>
      db.from('productivity_logs').select('date,productive_minutes').eq('user_id', userId).gte('date', from).lte('date', to).range(a, b)
    ),
  ]);
  const dailyCount = dailyTasks.data?.length ?? 0;
  const map = new Map<string, DayContext>();
  const get = (date: string) => {
    if (!map.has(date)) map.set(date, { date, tasksPlanned: 0, tasksCompleted: 0, productiveMinutes: null, mood: null, diaryText: '' });
    return map.get(date)!;
  };
  const minutes = new Map<string, number>();
  for (const s of statuses) {
    const c = get(s.date);
    c.tasksPlanned += 1;
    if (s.is_completed) c.tasksCompleted += 1;
    minutes.set(s.date, (minutes.get(s.date) ?? 0) + (s.minutes_spent ?? 0));
  }
  for (const c of map.values()) c.tasksPlanned = Math.max(c.tasksPlanned, dailyCount);
  for (const e of entries) {
    const c = get(e.date);
    c.mood = e.mood;
    c.diaryText = [e.summary, ...(e.wins ?? []), ...(e.challenges ?? [])].filter(Boolean).join(' \n');
  }
  for (const p of prod) if (p.productive_minutes != null) get(p.date).productiveMinutes = p.productive_minutes;
  for (const [d, m] of minutes) if (get(d).productiveMinutes == null && m > 0) get(d).productiveMinutes = m;
  return map;
}

/**
 * Recompute health_day for every date from `from` through today (max 100 days).
 * Idempotent: safe to call on every webhook, watch sync or cron run.
 */
export async function processHealthFrom(userId: string, from: string): Promise<HealthDay[]> {
  const db = getSupabaseAdmin();
  const today = localToday();
  if (from > today) from = today;
  const earliest = addDays(today, -100);
  if (from < earliest) from = earliest;

  const dates: string[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) dates.push(d);

  const [summaries, watchDaily, watchSamples, histRows] = await Promise.all([
    all<{ summary_type: string; data: GarminSummary }>((a, b) =>
      db.from('garmin_summaries').select('summary_type,data').eq('user_id', userId)
        .gte('calendar_date', addDays(from, -1)).lte('calendar_date', addDays(today, 1)).range(a, b)
    ),
    all<{ date: string; steps: number | null; step_goal: number | null; calories: number | null; active_minutes: number | null; respiration_rate: number | null }>((a, b) =>
      db.from('watch_daily').select('date,steps,step_goal,calories,active_minutes,respiration_rate').eq('user_id', userId).gte('date', from).range(a, b)
    ),
    all<{ metric: string; ts: string; value: number }>((a, b) =>
      db.from('watch_samples').select('metric,ts,value').eq('user_id', userId)
        .gte('ts', new Date(Date.parse(`${from}T00:00:00Z`) - offsetFor(from) * 1000).toISOString()).range(a, b)
    ),
    db.from('health_day').select('*').eq('user_id', userId).lt('date', from).order('date', { ascending: false }).limit(90),
  ]);

  const context = await loadContext(userId, addDays(from, -44), today);
  const history: HealthDay[] = ((histRows.data ?? []) as HealthDay[]).reverse();
  const results: HealthDay[] = [];

  for (const date of dates) {
    const offset = offsetFor(date);
    const raw: RawDay = {
      date, dailies: [], sleeps: [], hrv: [], stressDetails: [], pulseox: [], respiration: [],
      userMetrics: [], activities: [], epochs: [],
      watchDaily: watchDaily.find((w) => w.date === date) ?? null,
      watchSamples: watchSamples.filter((s) => {
        const t = Date.parse(s.ts) / 1000;
        return new Date((t + offset) * 1000).toISOString().slice(0, 10) === date;
      }),
    };
    for (const s of summaries) {
      const key = SUMMARY_KEYS[s.summary_type];
      if (!key) continue;
      const sd = summaryDate(s.data, offset);
      // activities/respiration/epochs belong to their start date; others to calendarDate
      if (sd === date) raw[key].push(s.data);
    }

    const ctxHistory = [...context.values()].filter((c) => c.date < date).sort((a, b) => a.date.localeCompare(b.date));
    const day = buildHealthDay(raw, history, offset, { today: context.get(date) ?? null, history: ctxHistory });
    const hasData = day.sources.length > 0;
    if (hasData || date === today) {
      history.push(day);
      results.push(day);
    }
  }

  if (results.length) {
    const rows = results.map((d) => roundInts({ user_id: userId, ...d, computed_at: new Date().toISOString() }));
    const { error } = await db.from('health_day').upsert(rows, { onConflict: 'user_id,date' });
    if (error) throw new Error(`health_day upsert failed: ${error.message}`);
    await syncSleepLogs(userId, results);
    await autoCompleteExercise(userId, results);
  }
  return results;
}

const INT_COLUMNS = [
  'sleep_minutes', 'deep_minutes', 'light_minutes', 'rem_minutes', 'awake_minutes', 'sleep_score', 'sleep_midpoint_min',
  'steps', 'step_goal', 'active_kcal', 'intensity_minutes', 'high_stress_minutes', 'bb_high', 'bb_low', 'bb_charged',
  'bb_drained', 'bb_at_wake', 'sleep_need_minutes', 'sleep_debt_minutes', 'sleep_consistency', 'recovery', 'readiness',
  'burnout_index', 'baseline_days',
] as const;

function roundInts<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of INT_COLUMNS) if (typeof out[k] === 'number') out[k] = Math.round(out[k] as number);
  return out as T;
}

/** B2: write Garmin sleep into sleep_wake_logs unless the user overrode it. */
async function syncSleepLogs(userId: string, days: HealthDay[]) {
  const db = getSupabaseAdmin();
  for (const d of days) {
    if (!d.sleep_start || !d.sleep_end) continue;
    const start = Date.parse(d.sleep_start) / 1000;
    const end = Date.parse(d.sleep_end) / 1000;
    const offset = offsetFor(d.date);
    const localStart = new Date((start + offset) * 1000);
    // Night belongs to the evening it started (sleep after midnight → previous day)
    const nightDate = new Date((start + offset - 12 * 3600) * 1000).toISOString().slice(0, 10);
    const startHHMM = hhmm(localStart.getUTCHours() * 60 + localStart.getUTCMinutes());
    const localEnd = new Date((end + offset) * 1000);
    const endHHMM = hhmm(localEnd.getUTCHours() * 60 + localEnd.getUTCMinutes());

    const { data: existing } = await db
      .from('sleep_wake_logs')
      .select('date,sleep_source,wake_source,wake_up_confirmed_at')
      .eq('user_id', userId)
      .in('date', [nightDate, d.date]);
    const night = existing?.find((e) => e.date === nightDate);
    const morning = existing?.find((e) => e.date === d.date);
    const now = new Date().toISOString();

    if (night?.sleep_source !== 'manual_override') {
      const { error } = await db.from('sleep_wake_logs').upsert(
        { user_id: userId, date: nightDate, sleep_time: startHHMM, sleep_duration_minutes: d.sleep_minutes, sleep_source: 'garmin', updated_at: now },
        { onConflict: 'date,user_id' }
      );
      if (error) console.error('[Health] sleep log upsert failed', error.message);
    }
    if (morning?.wake_source !== 'manual_override') {
      const { error } = await db.from('sleep_wake_logs').upsert(
        {
          user_id: userId,
          date: d.date,
          wake_up_time: endHHMM,
          wake_source: 'garmin',
          wake_up_confirmed_at: morning?.wake_up_confirmed_at ?? d.sleep_end,
          updated_at: now,
        },
        { onConflict: 'date,user_id' }
      );
      if (error) console.error('[Health] wake log upsert failed', error.message);
    }
  }
}

const EXERCISE_RE = /\b(exercise|workout|gym|run|running|walk|walking|cardio|training|yoga|cycle|cycling|swim)\b/i;

/** B2: tick daily exercise-type routine tasks when the watch saw ≥30 intensity minutes. */
async function autoCompleteExercise(userId: string, days: HealthDay[]) {
  const done = days.filter((d) => (d.intensity_minutes ?? 0) >= 30);
  if (!done.length) return;
  const db = getSupabaseAdmin();
  const { data: tasks } = await db.from('tasks').select('id,title').eq('user_id', userId).eq('is_daily', true).eq('is_archived', false);
  const exercise = (tasks ?? []).filter((t) => EXERCISE_RE.test(t.title));
  if (!exercise.length) return;
  for (const d of done) {
    const { data: existing } = await db
      .from('daily_task_status')
      .select('task_id,is_completed')
      .eq('user_id', userId)
      .eq('date', d.date)
      .in('task_id', exercise.map((t) => t.id));
    const already = new Set((existing ?? []).filter((e) => e.is_completed).map((e) => e.task_id));
    const rows = exercise
      .filter((t) => !already.has(t.id))
      .map((t) => ({
        task_id: t.id,
        user_id: userId,
        date: d.date,
        is_completed: true,
        completed_at: new Date().toISOString(),
        minutes_spent: d.intensity_minutes,
        source: 'garmin',
      }));
    if (rows.length) await db.from('daily_task_status').upsert(rows, { onConflict: 'task_id,date,user_id' });
  }
}

/** Latest processed day + previous 30 for UI/API consumers. */
export async function getHealthDays(userId: string, days = 31): Promise<HealthDay[]> {
  const { data } = await getSupabaseAdmin()
    .from('health_day')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(days);
  return ((data ?? []) as HealthDay[]).reverse();
}
