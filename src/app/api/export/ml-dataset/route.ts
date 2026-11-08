// GET /api/export/ml-dataset
// Returns all daily training rows joined across every data source.
// Format: JSON array (default) or NDJSON (?format=ndjson) for streaming ML pipelines.
// Gate: requires ML_EXPORT_SECRET header matching env var ML_EXPORT_SECRET.
//
// Each row = one calendar day. All columns null-safe — missing data is null, not omitted.
// Sorted ascending by date so rows are temporally ordered for sequential models.
//
// Health features (PLAN.md B7) come from health_day as `health_<column>` (numeric
// columns as-is, booleans as 0/1). steps / active_minutes are also filled from
// health_day (sensor_logs never existed in prod). This export is for local /
// on-device models only; never forward it to a hosted LLM.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Numeric health_day columns exported as `health_<name>` */
const HEALTH_NUMERIC_COLUMNS = [
  'sleep_minutes', 'deep_minutes', 'light_minutes', 'rem_minutes', 'awake_minutes',
  'sleep_score', 'sleep_midpoint_min',
  'hrv_night', 'rhr', 'resp_night', 'spo2_avg',
  'steps', 'step_goal', 'active_kcal', 'intensity_minutes',
  'stress_avg', 'stress_max', 'high_stress_minutes',
  'bb_high', 'bb_low', 'bb_charged', 'bb_drained', 'bb_at_wake',
  'vo2max', 'max_hr_observed',
  'training_load', 'strain', 'ctl', 'atl', 'tsb',
  'sleep_need_minutes', 'sleep_debt_minutes', 'sleep_consistency',
  'recovery', 'readiness', 'capacity_hours', 'illness_score', 'burnout_index', 'baseline_days',
] as const;
/** Boolean health_day columns exported as `health_<name>` = 0/1 */
const HEALTH_BOOLEAN_COLUMNS = ['illness_flag', 'late_activity'] as const;

/** Postgres / PostgREST "table does not exist" — treat as empty optional source */
function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  return e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? '');
}

export async function GET(request: NextRequest) {
  // Auth gate
  const secret = request.headers.get('x-ml-export-secret');
  if (!secret || secret !== process.env.ML_EXPORT_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'User not configured' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'json';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // ── Fetch all tables in parallel ──────────────────────────────────────────
  const [
    diaryRes,
    healthRes,
    sleepRes,
    habitRes,
    readinessRes,
    nudgeRes,
  ] = await Promise.all([
    supabase
      .from('daily_entries')
      .select('date,mood,energy_level,summary,wins,challenges,productivity_data,custom_fields,embedding')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .then(r => applyDateRange(r, startDate, endDate, 'date')),

    supabase
      .from('health_day')
      .select<string, { date: string } & Record<string, unknown>>(['date', ...HEALTH_NUMERIC_COLUMNS, ...HEALTH_BOOLEAN_COLUMNS].join(','))
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .then(r => applyDateRange(r, startDate, endDate, 'date')),

    supabase
      .from('sleep_wake_logs')
      .select('date,wake_up_time,wake_up_mood,sleep_time,sleep_duration_minutes')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .then(r => applyDateRange(r, startDate, endDate, 'date')),

    // Habit completions: aggregate per day
    supabase
      .from('habit_completions')
      .select('completed_at,habit_id,skipped,nudge_triggered,nudge_type')
      .eq('user_id', userId)
      .order('completed_at', { ascending: true }),

    supabase
      .from('readiness_scores')
      .select('date,readiness,sleep_score,step_score,habit_score,goal_score,mood_trend,step_trend,sleep_trend_hours,total_goal_hours,steps_today,window_days')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .then(r => applyDateRange(r, startDate, endDate, 'date')),

    // Nudge events: aggregate per day
    supabase
      .from('nudge_events')
      .select('evaluated_at,nudge_type,was_shown,ctx_steps_today,ctx_seven_day_avg,ctx_has_diary,ctx_habit_count,ctx_goal_count')
      .eq('user_id', userId)
      .order('evaluated_at', { ascending: true }),
  ]);

  // Surface DB errors; optional sources whose table doesn't exist are skipped
  for (const res of [diaryRes, healthRes, sleepRes, habitRes, readinessRes, nudgeRes]) {
    if (!res.error) continue;
    if (res !== diaryRes && isMissingTable(res.error)) {
      console.warn('[ML export] skipping missing table:', (res.error as { message?: string }).message);
      (res as { data: unknown[] | null }).data = [];
      continue;
    }
    return NextResponse.json({ error: (res.error as { message?: string }).message ?? 'Database error' }, { status: 500 });
  }

  // ── Index by date ─────────────────────────────────────────────────────────
  const byDate = new Map<string, DailyRow>();

  const upsert = (date: string): DailyRow => {
    if (!byDate.has(date)) byDate.set(date, { date });
    return byDate.get(date)!;
  };

  for (const row of diaryRes.data ?? []) {
    const d = upsert(row.date);
    d.mood = row.mood ?? null;
    d.energy_level = row.energy_level ?? null;
    d.summary = row.summary ?? null;
    d.wins = row.wins ?? null;
    d.challenges = row.challenges ?? null;
    d.productivity_data = row.productivity_data ?? null;
    d.custom_fields = row.custom_fields ?? null;
    d.has_embedding = row.embedding != null;
  }

  for (const raw of healthRes.data ?? []) {
    const d = upsert(raw.date);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : v == null ? null : Number(v));
    for (const col of HEALTH_NUMERIC_COLUMNS) d[`health_${col}`] = num(raw[col]);
    for (const col of HEALTH_BOOLEAN_COLUMNS) d[`health_${col}`] = raw[col] == null ? null : raw[col] ? 1 : 0;
    // Legacy sensor columns (formerly from sensor_logs)
    d.steps = num(raw.steps);
    d.distance_meters = null;
    d.active_minutes = num(raw.intensity_minutes);
    d.sensor_source = 'health_day';
  }

  for (const row of sleepRes.data ?? []) {
    const d = upsert(row.date);
    d.sleep_duration_minutes = row.sleep_duration_minutes ?? null;
    d.wake_up_mood = row.wake_up_mood ?? null;
    d.wake_up_time = row.wake_up_time ?? null;
    d.sleep_time = row.sleep_time ?? null;
  }

  // Habit completions: aggregate counts per calendar date
  for (const row of habitRes.data ?? []) {
    const date = row.completed_at.substring(0, 10);
    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;
    const d = upsert(date);
    d.habits_completed = (d.habits_completed ?? 0) + (row.skipped ? 0 : 1);
    d.habits_skipped = (d.habits_skipped ?? 0) + (row.skipped ? 1 : 0);
    d.habits_nudge_triggered = (d.habits_nudge_triggered ?? 0) + (row.nudge_triggered ? 1 : 0);
  }

  for (const row of readinessRes.data ?? []) {
    const d = upsert(row.date);
    d.readiness = row.readiness ?? null;
    d.sleep_score = row.sleep_score ?? null;
    d.step_score = row.step_score ?? null;
    d.habit_score = row.habit_score ?? null;
    d.goal_score = row.goal_score ?? null;
    d.mood_trend = row.mood_trend ?? null;
    d.step_trend = row.step_trend ?? null;
    d.sleep_trend_hours = row.sleep_trend_hours ?? null;
    d.total_goal_hours = row.total_goal_hours ?? null;
    d.readiness_window_days = row.window_days ?? null;
  }

  // Nudge events: aggregate per day
  for (const row of nudgeRes.data ?? []) {
    const date = row.evaluated_at.substring(0, 10);
    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;
    const d = upsert(date);
    d.nudge_evaluations = (d.nudge_evaluations ?? 0) + 1;
    d.nudges_shown = (d.nudges_shown ?? 0) + (row.was_shown ? 1 : 0);
    // Keep last nudge type shown
    if (row.was_shown && row.nudge_type) d.last_nudge_type = row.nudge_type;
  }

  // ── Sort ascending ────────────────────────────────────────────────────────
  const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  if (format === 'ndjson') {
    const ndjson = rows.map(r => JSON.stringify(r)).join('\n');
    return new NextResponse(ndjson, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Content-Disposition': `attachment; filename="ml-dataset-${new Date().toISOString().substring(0, 10)}.ndjson"`,
      },
    });
  }

  return NextResponse.json(
    { rows, total: rows.length, exported_at: new Date().toISOString() },
    { headers: { 'Content-Disposition': `attachment; filename="ml-dataset-${new Date().toISOString().substring(0, 10)}.json"` } }
  );
}

// Re-applies date range filter post-fetch (supabase client doesn't chain .then on builder)
function applyDateRange<T extends { data: { date?: string }[] | null; error: unknown }>(
  res: T, startDate: string | null, endDate: string | null, field: string
): T {
  if (!res.data || (!startDate && !endDate)) return res;
  res.data = res.data.filter((r: Record<string, string>) => {
    const d = r[field];
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  }) as typeof res.data;
  return res;
}

interface DailyRow {
  date: string;
  // diary
  mood?: number | null;
  energy_level?: number | null;
  summary?: string | null;
  wins?: string[] | null;
  challenges?: string[] | null;
  productivity_data?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
  has_embedding?: boolean;
  // sensor (now sourced from health_day)
  steps?: number | null;
  distance_meters?: number | null;
  active_minutes?: number | null;
  sensor_source?: string | null;
  // sleep
  sleep_duration_minutes?: number | null;
  wake_up_mood?: number | null;
  wake_up_time?: string | null;
  sleep_time?: string | null;
  // habits
  habits_completed?: number;
  habits_skipped?: number;
  habits_nudge_triggered?: number;
  // readiness
  readiness?: number | null;
  sleep_score?: number | null;
  step_score?: number | null;
  habit_score?: number | null;
  goal_score?: number | null;
  mood_trend?: number[] | null;
  step_trend?: number[] | null;
  sleep_trend_hours?: number[] | null;
  total_goal_hours?: number | null;
  readiness_window_days?: number | null;
  // nudges
  nudge_evaluations?: number;
  nudges_shown?: number;
  last_nudge_type?: string;
  // health_day features: health_<column> (numbers; booleans as 0/1)
  [healthFeature: `health_${string}`]: number | null | undefined;
}
