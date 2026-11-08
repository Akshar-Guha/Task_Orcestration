import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/user';
import { watchAuthorized } from '@/lib/watch-auth';
import { fmtMinutes, localNow, ruleRunsToday, toMinutes, userTimezone } from './shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/watch/tasks — today's routine tasks for the Garmin watch (PLAN.md B9).
 * Polled every 5 min by the Connect IQ background service, so keep it small.
 *
 * Response:
 * {
 *   now: 'HH:MM',                     // user's local time
 *   readiness: number | null,         // health_day.readiness for today (or latest)
 *   tasks: [{ id, title, due: 'HH:MM' | null, status: 'pending'|'done'|'snoozed'|'skipped', snoozedUntil: epochSeconds | null }],
 *   dueNow: [id, ...]                 // due in the last 10 min, or snooze just expired; not done/skipped/acked
 * }
 */
const MAX_TASKS = 20;
const TITLE_MAX = 40;
const DUE_WINDOW_MIN = 10;

type Status = 'pending' | 'done' | 'snoozed' | 'skipped';

export async function GET(request: NextRequest) {
  if (!watchAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'User not configured' }, { status: 500 });

  const db = getSupabaseAdmin();
  const tz = await userTimezone(db, userId);
  const now = new Date();
  const local = localNow(tz, now);
  const nowMs = now.getTime();

  const { data: taskRows, error } = await db
    .from('tasks')
    .select('id,title,goal_id,is_completed,completed_at')
    .eq('user_id', userId)
    .eq('is_daily', true)
    .eq('is_archived', false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tasks = taskRows ?? [];
  const ids = tasks.map((t) => t.id as string);

  const [rulesRes, slotsRes, statusRes, ackRes, healthRes] = await Promise.all([
    ids.length
      ? db
          .from('notification_rules')
          .select('id,schedule_time,repeat_days,linked_entity_id')
          .eq('user_id', userId)
          .eq('is_enabled', true)
          .eq('notification_type', 'task')
          .in('linked_entity_id', ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    db.from('time_slots').select('start_time,goal_ids,is_active').eq('user_id', userId),
    ids.length
      ? db
          .from('daily_task_status')
          .select('task_id,is_completed,snoozed_until,skipped_reason')
          .eq('user_id', userId)
          .eq('date', local.date)
          .in('task_id', ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    db
      .from('notification_acks')
      .select('rule_id')
      .eq('user_id', userId)
      .eq('acked_date', local.date)
      .not('acked_at', 'is', null),
    db
      .from('health_day')
      .select('date,readiness')
      .eq('user_id', userId)
      .lte('date', local.date)
      .order('date', { ascending: false })
      .limit(1),
  ]);

  // Due time per task: earliest enabled linked rule that runs today
  const ackedRules = new Set((ackRes.data ?? []).map((a) => a.rule_id as string));
  const dueByTask = new Map<string, number>();
  const rulesByTask = new Map<string, string[]>();
  for (const r of (rulesRes.data ?? []) as Record<string, unknown>[]) {
    const taskId = r.linked_entity_id as string;
    if (!ruleRunsToday(r.repeat_days, local.dow)) continue;
    const m = toMinutes(r.schedule_time as string | null);
    if (m == null) continue;
    rulesByTask.set(taskId, [...(rulesByTask.get(taskId) ?? []), r.id as string]);
    const prev = dueByTask.get(taskId);
    if (prev == null || m < prev) dueByTask.set(taskId, m);
  }

  // Fallback: start of the active time slot that holds the task's goal
  const slotStartByGoal = new Map<string, number>();
  for (const s of (slotsRes.data ?? []) as { start_time: string; goal_ids: string[] | null; is_active: boolean | null }[]) {
    if (s.is_active === false) continue;
    const m = toMinutes(s.start_time);
    if (m == null) continue;
    for (const g of s.goal_ids ?? []) {
      const prev = slotStartByGoal.get(g);
      if (prev == null || m < prev) slotStartByGoal.set(g, m);
    }
  }

  const statusByTask = new Map<string, Record<string, unknown>>();
  for (const s of (statusRes.data ?? []) as Record<string, unknown>[]) statusByTask.set(s.task_id as string, s);

  const out: { id: string; title: string; due: string | null; status: Status; snoozedUntil: number | null }[] = [];
  const dueNow: string[] = [];
  const sortKey = new Map<string, number>();

  for (const t of tasks) {
    const id = t.id as string;
    const st = statusByTask.get(id);
    const doneToday =
      st?.is_completed === true ||
      (t.is_completed === true &&
        typeof t.completed_at === 'string' &&
        new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t.completed_at)) === local.date);
    const snoozeMs = typeof st?.snoozed_until === 'string' ? Date.parse(st.snoozed_until) : NaN;
    let status: Status = 'pending';
    if (doneToday) status = 'done';
    else if (st?.skipped_reason) status = 'skipped';
    else if (Number.isFinite(snoozeMs) && snoozeMs > nowMs) status = 'snoozed';

    const due = dueByTask.get(id) ?? (t.goal_id ? slotStartByGoal.get(t.goal_id as string) : undefined) ?? null;

    // Acked on the phone (without marking done) also silences the watch
    const rules = rulesByTask.get(id) ?? [];
    const acked = rules.length > 0 && rules.every((r) => ackedRules.has(r));

    if (status === 'pending' && !acked) {
      const snoozeExpired = Number.isFinite(snoozeMs) && snoozeMs <= nowMs && nowMs - snoozeMs <= DUE_WINDOW_MIN * 60_000;
      const justDue =
        !Number.isFinite(snoozeMs) &&
        due != null &&
        local.minuteOfDay >= due &&
        local.minuteOfDay - due <= DUE_WINDOW_MIN;
      if (snoozeExpired || justDue) dueNow.push(id);
    }

    out.push({
      id,
      title: String(t.title ?? '').slice(0, TITLE_MAX),
      due: due != null ? fmtMinutes(due) : null,
      status,
      snoozedUntil: Number.isFinite(snoozeMs) && status === 'snoozed' ? Math.floor(snoozeMs / 1000) : null,
    });
    sortKey.set(id, due ?? 24 * 60);
  }

  out.sort((a, b) => (sortKey.get(a.id)! - sortKey.get(b.id)!) || a.title.localeCompare(b.title));
  const limited = out.slice(0, MAX_TASKS);
  const kept = new Set(limited.map((t) => t.id));

  const h = (healthRes.data ?? [])[0] as { readiness: number | null } | undefined;
  return NextResponse.json({
    now: local.hhmm,
    readiness: h?.readiness ?? null,
    tasks: limited,
    dueNow: dueNow.filter((id) => kept.has(id)),
  });
}
