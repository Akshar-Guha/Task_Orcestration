import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/user';
import { watchAuthorized } from '@/lib/watch-auth';
import { localNow, userTimezone } from '../../shared';

/**
 * POST /api/watch/tasks/{id}/action — Done / Snooze / Skip from the watch (PLAN.md B9).
 * Body: { action: 'done' | 'snooze' | 'skip', minutes?: number (snooze, default 15, 1–240),
 *         reason?: string (skip), ts?: epoch seconds when tapped (queued offline on the watch;
 *         used for the day + completed_at if within the last 24 h) }
 *
 * Writes daily_task_status (source 'watch') exactly like the push "yes" action in
 * /api/notifications/action does, and acks today's linked notification rules on
 * done/skip so the phone alarm stops re-firing ("ack on either clears both").
 * Snooze does not ack: the phone keeps its own snooze cadence; the watch re-alerts
 * from GET /api/watch/tasks when snoozed_until passes.
 *
 * Response: { ok: true, id, status: 'done'|'snoozed'|'skipped', snoozedUntil?: epochSeconds }
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!watchAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'User not configured' }, { status: 500 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'done' && action !== 'snooze' && action !== 'skip') {
    return NextResponse.json({ error: "action must be 'done', 'snooze' or 'skip'" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: task } = await db
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const tz = await userTimezone(db, userId);
  const nowMs = Date.now();
  const tsMs = typeof body?.ts === 'number' && Number.isFinite(body.ts) ? body.ts * 1000 : NaN;
  const at = tsMs <= nowMs + 60_000 && tsMs >= nowMs - 24 * 3600_000 ? new Date(tsMs) : new Date(nowMs);
  const today = localNow(tz, at).date;
  const nowIso = at.toISOString();
  const base = { task_id: id, user_id: userId, date: today, source: 'watch' };

  let row: Record<string, unknown>;
  let snoozedUntil: number | undefined;
  if (action === 'done') {
    row = { ...base, is_completed: true, completed_at: nowIso, snoozed_until: null, skipped_reason: null };
  } else if (action === 'snooze') {
    const raw = Number(body?.minutes);
    const minutes = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.round(raw), 240) : 15;
    const until = new Date(at.getTime() + minutes * 60_000);
    snoozedUntil = Math.floor(until.getTime() / 1000);
    row = { ...base, is_completed: false, snoozed_until: until.toISOString(), skipped_reason: null };
  } else {
    const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 60) : 'skipped';
    row = { ...base, is_completed: false, snoozed_until: null, skipped_reason: reason };
  }

  const { error: upErr } = await db.from('daily_task_status').upsert(row, { onConflict: 'task_id,date,user_id' });
  if (upErr) {
    console.error('[Watch/Action] status upsert failed', upErr.message);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  if (action === 'done') {
    // Same as the push "yes" action: mark the task itself complete (daily tasks reset next day)
    await db.from('tasks').update({ is_completed: true, completed_at: nowIso }).eq('id', id).eq('user_id', userId);
  }

  if (action !== 'snooze') {
    const { data: rules } = await db
      .from('notification_rules')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_type', 'task')
      .eq('linked_entity_id', id);
    const acks = (rules ?? []).map((r) => ({ rule_id: r.id, user_id: userId, acked_date: today, acked_at: nowIso }));
    if (acks.length) {
      const { error: ackErr } = await db.from('notification_acks').upsert(acks, { onConflict: 'rule_id,acked_date' });
      if (ackErr) console.error('[Watch/Action] ack failed', ackErr.message);
    }
  }

  const status = action === 'done' ? 'done' : action === 'snooze' ? 'snoozed' : 'skipped';
  return NextResponse.json({ ok: true, id, status, ...(snoozedUntil ? { snoozedUntil } : {}) });
}
