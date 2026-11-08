/**
 * Live-state health nudges (PLAN.md B4, C2 "break reminders by physiology").
 *
 * Pure part: `evaluateNudges(state)` turns a snapshot of recent watch samples
 * + today's health_day into zero or more nudges. Server part:
 * `loadNudgeState()` builds that snapshot from Supabase and
 * `runHealthNudges()` sends the nudges (via an injected sender) and records
 * them in health_nudges for dedupe.
 *
 * Rule-based only: no watch/Garmin data is ever sent to an LLM.
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import { addDays, tzOffsetSeconds, type HealthDay } from '@/lib/health';
import { USER_TZ } from '@/lib/health-server';

export type NudgeKind = 'stress_break' | 'low_battery' | 'quiet_day';

export interface Nudge {
  kind: NudgeKind;
  title: string;
  body: string;
  appUrl: string;
  payload: Record<string, unknown>;
}

export interface Sample {
  ts: string;
  value: number;
}

export interface NudgeState {
  now: Date;
  /** Local minutes since midnight in the user's zone */
  localMinute: number;
  /** stress samples, last ~60 min, ascending */
  stress: Sample[];
  /** hr samples, last ~15 min, ascending */
  hr: Sample[];
  /** latest Body Battery sample (if any) */
  bodyBattery: Sample | null;
  /** Median Body Battery at this local time over the last 14 days (evening only) */
  typicalBodyBattery: number | null;
  /** Daily routine tasks not completed/skipped today */
  remainingDailyTasks: number;
  today: Pick<HealthDay, 'illness_flag' | 'illness_score'> | null;
  /** Nudge kinds already sent inside their dedupe window */
  recentlySent: Set<NudgeKind>;
}

export const NUDGE_DEDUPE_MINUTES = 120;
const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const EVENING = 18 * 60;
const STRESS_WINDOW_MIN = 45;
const ACTIVITY_WINDOW_MIN = 10;

const ageMin = (s: Sample, now: Date) => (now.getTime() - Date.parse(s.ts)) / 60000;

/** Quiet day = illness early-warning fired for today (A4). */
export function isQuietHealthDay(day: Pick<HealthDay, 'illness_flag'> | null | undefined): boolean {
  return day?.illness_flag === true;
}

/** Latest HR above 120 for the whole last 10 minutes → workout/activity in progress. */
export function isActivityInProgress(hr: Sample[], now: Date): boolean {
  const recent = hr.filter((s) => ageMin(s, now) <= ACTIVITY_WINDOW_MIN && s.value > 0);
  if (recent.length < 2) return false;
  const oldest = Math.max(...recent.map((s) => ageMin(s, now)));
  if (oldest < ACTIVITY_WINDOW_MIN * 0.5) return false; // need the window covered
  return recent.every((s) => s.value > 120);
}

/** Sustained stress: last 45 min all > 60, or average > 70 (needs ≥30 min of coverage). */
export function sustainedStress(stress: Sample[], now: Date): { avg: number; min: number; n: number } | null {
  // Garmin uses negative values for "unmeasurable/activity"
  const win = stress.filter((s) => ageMin(s, now) <= STRESS_WINDOW_MIN && s.value >= 0);
  if (win.length < 5) return null;
  const span = Math.max(...win.map((s) => ageMin(s, now))) - Math.min(...win.map((s) => ageMin(s, now)));
  if (span < 30) return null;
  const vals = win.map((s) => s.value);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  if (min > 60 || avg > 70) return { avg: Math.round(avg), min: Math.round(min), n: vals.length };
  return null;
}

/** Pure: snapshot → nudges to send now (already deduped). */
export function evaluateNudges(s: NudgeState): Nudge[] {
  const out: Nudge[] = [];
  const awake = s.localMinute >= DAY_START && s.localMinute < DAY_END;

  if (isQuietHealthDay(s.today) && awake && !s.recentlySent.has('quiet_day')) {
    out.push({
      kind: 'quiet_day',
      title: 'Take it easy today',
      body: 'Your overnight signals look like you may be getting sick. Non-essential reminders are muted today.',
      appUrl: '/dashboard',
      payload: { illness_score: s.today?.illness_score ?? null },
    });
  }

  if (!awake || isActivityInProgress(s.hr, s.now)) return out;

  const stress = sustainedStress(s.stress, s.now);
  if (stress && !s.recentlySent.has('stress_break')) {
    out.push({
      kind: 'stress_break',
      title: 'Take a 10-minute break',
      body: `Your stress has been high for the last ${STRESS_WINDOW_MIN} min (avg ${stress.avg}). Step away, breathe, get some water.`,
      appUrl: '/dashboard',
      payload: stress,
    });
  }

  const bb = s.bodyBattery;
  if (bb && ageMin(bb, s.now) <= 20 && s.remainingDailyTasks > 0 && !s.recentlySent.has('low_battery')) {
    const threshold =
      s.localMinute < EVENING ? 25 : s.typicalBodyBattery != null ? Math.max(5, s.typicalBodyBattery - 10) : null;
    if (threshold != null && bb.value < threshold) {
      const n = s.remainingDailyTasks;
      out.push({
        kind: 'low_battery',
        title: 'Move remaining tasks to tomorrow',
        body: `Body Battery is ${Math.round(bb.value)}${s.localMinute >= EVENING && s.typicalBodyBattery != null ? ` (you usually have ~${Math.round(s.typicalBodyBattery)} by now)` : ''}. ${n} routine task${n === 1 ? '' : 's'} left today. Consider moving ${n === 1 ? 'it' : 'them'} to tomorrow.`,
        appUrl: '/tasks',
        payload: { body_battery: bb.value, threshold, remaining: n, typical: s.typicalBodyBattery },
      });
    }
  }
  return out;
}

// ─── Server side ──────────────────────────────────────────────────────────────

function localMinuteOf(now: Date, tz: string): number {
  const off = tzOffsetSeconds(tz, now);
  const d = new Date(now.getTime() + off * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function localDateOf(now: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Health day for today has illness_flag → mute non-essential reminders. */
export async function isQuietDay(userId: string, tz = USER_TZ, now = new Date()): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from('health_day')
    .select('illness_flag')
    .eq('user_id', userId)
    .eq('date', localDateOf(now, tz))
    .maybeSingle();
  return isQuietHealthDay(data as Pick<HealthDay, 'illness_flag'> | null);
}

/** Median Body Battery within ±20 min of this local time on each of the last 14 days. */
async function typicalBodyBatteryAt(userId: string, now: Date, tz: string, localMinute: number): Promise<number | null> {
  const db = getSupabaseAdmin();
  const todayLocal = localDateOf(now, tz);
  const perDay: number[] = [];
  // One narrow query per day keeps the row count tiny (~8 rows each).
  const queries = [];
  for (let i = 1; i <= 14; i++) {
    const date = addDays(todayLocal, -i);
    const off = tzOffsetSeconds(tz, new Date(`${date}T12:00:00Z`));
    const center = Date.parse(`${date}T00:00:00Z`) - off * 1000 + localMinute * 60000;
    queries.push(
      db.from('watch_samples').select('value').eq('user_id', userId).eq('metric', 'bodyBattery')
        .gte('ts', new Date(center - 20 * 60000).toISOString())
        .lte('ts', new Date(center + 20 * 60000).toISOString())
    );
  }
  const results = await Promise.all(queries);
  for (const r of results) {
    const m = median((r.data ?? []).map((x: { value: number }) => x.value).filter((v) => v >= 0));
    if (m != null) perDay.push(m);
  }
  return perDay.length >= 5 ? median(perDay) : null;
}

async function remainingDailyTasks(userId: string, today: string): Promise<number> {
  const db = getSupabaseAdmin();
  const [{ data: tasks }, { data: statuses }] = await Promise.all([
    db.from('tasks').select('id').eq('user_id', userId).eq('is_daily', true).eq('is_archived', false),
    db.from('daily_task_status').select('task_id,is_completed,skipped_reason').eq('user_id', userId).eq('date', today),
  ]);
  const handled = new Set(
    (statuses ?? [])
      .filter((s: { is_completed: boolean; skipped_reason: string | null }) => s.is_completed || !!s.skipped_reason)
      .map((s: { task_id: string }) => s.task_id)
  );
  return (tasks ?? []).filter((t: { id: string }) => !handled.has(t.id)).length;
}

/**
 * Build the live snapshot. Returns null when the dedupe table is unavailable
 * (e.g. migration not applied yet) so we never spam without dedupe.
 */
export async function loadNudgeState(userId: string, tz = USER_TZ, now = new Date()): Promise<NudgeState | null> {
  const db = getSupabaseAdmin();
  const today = localDateOf(now, tz);
  const localMinute = localMinuteOf(now, tz);
  const since = (min: number) => new Date(now.getTime() - min * 60000).toISOString();

  const [sent, stress, hr, bb, day] = await Promise.all([
    db.from('health_nudges').select('kind,sent_at').eq('user_id', userId).gte('sent_at', since(24 * 60)),
    db.from('watch_samples').select('ts,value').eq('user_id', userId).eq('metric', 'stress')
      .gte('ts', since(60)).order('ts', { ascending: true }),
    db.from('watch_samples').select('ts,value').eq('user_id', userId).eq('metric', 'hr')
      .gte('ts', since(15)).order('ts', { ascending: true }),
    db.from('watch_samples').select('ts,value').eq('user_id', userId).eq('metric', 'bodyBattery')
      .gte('ts', since(60)).order('ts', { ascending: false }).limit(1),
    db.from('health_day').select('illness_flag,illness_score').eq('user_id', userId).eq('date', today).maybeSingle(),
  ]);

  if (sent.error) {
    console.warn('[HealthNudges] health_nudges unavailable, skipping nudges:', sent.error.message);
    return null;
  }

  const recentlySent = new Set<NudgeKind>();
  for (const row of (sent.data ?? []) as { kind: NudgeKind; sent_at: string }[]) {
    const age = (now.getTime() - Date.parse(row.sent_at)) / 60000;
    // quiet_day: once per local day; everything else: once per 2h
    if (row.kind === 'quiet_day') {
      if (localDateOf(new Date(row.sent_at), tz) === today) recentlySent.add(row.kind);
    } else if (age < NUDGE_DEDUPE_MINUTES) {
      recentlySent.add(row.kind);
    }
  }

  const latestBb = ((bb.data ?? [])[0] as Sample | undefined) ?? null;
  const needTypical =
    latestBb != null && localMinute >= EVENING && localMinute < DAY_END && !recentlySent.has('low_battery');

  const [typical, remaining] = await Promise.all([
    needTypical ? typicalBodyBatteryAt(userId, now, tz, localMinute) : Promise.resolve(null),
    latestBb != null && !recentlySent.has('low_battery') ? remainingDailyTasks(userId, today) : Promise.resolve(0),
  ]);

  return {
    now,
    localMinute,
    stress: (stress.data ?? []) as Sample[],
    hr: (hr.data ?? []) as Sample[],
    bodyBattery: latestBb,
    typicalBodyBattery: typical,
    remainingDailyTasks: remaining,
    today: (day.data as NudgeState['today']) ?? null,
    recentlySent,
  };
}

export type NudgeSender = (nudge: Nudge) => Promise<boolean>;

/** Evaluate + send + record. Returns the kinds that were sent. */
export async function runHealthNudges(userId: string, send: NudgeSender, tz = USER_TZ, now = new Date()): Promise<NudgeKind[]> {
  const state = await loadNudgeState(userId, tz, now);
  if (!state) return [];
  const sentKinds: NudgeKind[] = [];
  for (const nudge of evaluateNudges(state)) {
    const ok = await send(nudge);
    if (!ok) continue;
    sentKinds.push(nudge.kind);
    const { error } = await getSupabaseAdmin()
      .from('health_nudges')
      .insert({ user_id: userId, kind: nudge.kind, sent_at: now.toISOString(), payload: nudge.payload });
    if (error) console.error('[HealthNudges] failed to record nudge', error.message);
  }
  return sentKinds;
}
