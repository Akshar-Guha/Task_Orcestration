import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/push/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fix: remove hardcoded UUID — require env var; fail loudly if missing so cron errors are visible
const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? '';

/**
 * GET /api/cron/notifications â€” runs every minute via Vercel cron.
 *
 * For each enabled rule:
 * - Normal: fires once when schedule_time matches current HH:MM
 * - Alarm (requires_acknowledgment=true): fires at schedule_time, then re-fires
 *   every snooze_interval_minutes until the user acks it for today.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fix: guard against missing USER_ID before hitting the DB
  if (!USER_ID) {
    return NextResponse.json({ error: 'User ID not configured' }, { status: 500 });
  }

  // Resolve user's local time
  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('timezone')
    .eq('user_id', USER_ID)
    .single();
  const tz = settingsRow?.timezone || process.env.USER_TIMEZONE || 'UTC';

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
  const currentTime = `${parts.hour}:${parts.minute}`;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const currentDayOfWeek = weekdayMap[parts.weekday] ?? now.getDay();

  // Current minute offset since midnight (for snooze math)
  const [hh, mm] = currentTime.split(':').map(Number);
  const currentMinuteOfDay = hh * 60 + mm;

  // Today's date in user's timezone
  const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  const today = todayFormatter.format(now); // YYYY-MM-DD

  // Fetch all enabled, non-manual rules
  const { data: rules, error } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('is_enabled', true)
    .eq('is_manual', false)
    .not('schedule_time', 'is', null);

  if (error) {
    console.error('[Cron/Notifications] DB error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch all today's acks for this user (only genuine user acks, not fire-count tracking rows)
  const { data: acks } = await supabase
    .from('notification_acks')
    .select('rule_id')
    .eq('user_id', USER_ID)
    .eq('acked_date', today)
    .not('acked_at', 'is', null);
  const ackedRuleIds = new Set((acks || []).map((a: { rule_id: string }) => a.rule_id));

  // Auto-ack: check if the linked entity was already acted on today
  async function checkAutoAck(notifType: string, entityId: string | null): Promise<boolean> {
    switch (notifType) {
      case 'task': {
        if (!entityId) return false;
        const { data } = await supabase
          .from('daily_task_status').select('id')
          .eq('user_id', USER_ID).eq('task_id', entityId).eq('date', today).eq('is_completed', true).limit(1);
        if ((data?.length ?? 0) > 0) return true;
        // Also check if task itself is marked complete
        const { data: task } = await supabase
          .from('tasks').select('is_completed').eq('id', entityId).single();
        return task?.is_completed === true;
      }
      case 'habit': {
        if (!entityId) return false;
        const { data } = await supabase
          .from('habit_completions').select('id')
          .eq('user_id', USER_ID).eq('habit_id', entityId)
          .gte('completed_at', `${today}T00:00:00Z`).limit(1);
        return (data?.length ?? 0) > 0;
      }
      case 'goal': {
        if (!entityId) return false;
        const { data } = await supabase
          .from('goals').select('last_activity_at').eq('id', entityId).single();
        return !!data?.last_activity_at && data.last_activity_at >= `${today}T00:00:00Z`;
      }
      case 'sleep_wake': {
        const { data } = await supabase
          .from('sleep_wake_logs').select('id').eq('user_id', USER_ID)
          .gte('created_at', `${today}T00:00:00Z`).limit(1);
        return (data?.length ?? 0) > 0;
      }
      default:
        return false;
    }
  }

  async function autoAckAndMark(ruleId: string): Promise<void> {
    await supabase.from('notification_acks').upsert(
      { rule_id: ruleId, user_id: USER_ID, acked_date: today, acked_at: new Date().toISOString() },
      { onConflict: 'rule_id,acked_date' }
    );
    ackedRuleIds.add(ruleId);
  }

  // Fetch today's fire counts for all rules (to enforce max_snooze_count)
  const { data: ackRows } = await supabase
    .from('notification_acks')
    .select('rule_id, fire_count')
    .eq('user_id', USER_ID)
    .eq('acked_date', today);
  const fireCountMap = new Map<string, number>(
    (ackRows || []).map((a: { rule_id: string; fire_count: number }) => [a.rule_id, a.fire_count ?? 0])
  );

  // Hard safety net: never re-fire more than this many minutes after start
  const ABSOLUTE_MAX_WINDOW_MINUTES = 240; // 4 hours

  const fired: string[] = [];
  const skipped: string[] = [];
  const autoStopped: string[] = [];

  for (const rule of rules ?? []) {
    // Check day-of-week
    if (rule.repeat_days?.length && !rule.repeat_days.includes(currentDayOfWeek)) {
      skipped.push(rule.id);
      continue;
    }

    const [ruleHH, ruleMM] = (rule.schedule_time as string).split(':').map(Number);
    const ruleMinuteOfDay = ruleHH * 60 + ruleMM;
    const minutesSinceStart = currentMinuteOfDay - ruleMinuteOfDay;

    // Skip if notification hasn't started yet today
    if (minutesSinceStart < 0) {
      skipped.push(rule.id);
      continue;
    }

    const isAlarm = !!rule.requires_acknowledgment;
    const snoozeInterval: number = rule.snooze_interval_minutes || 0;

    if (isAlarm) {
      // Already acknowledged today â†’ stop
      if (ackedRuleIds.has(rule.id)) {
        skipped.push(rule.id);
        continue;
      }

      // Auto-ack: check if the linked data was already entered today
      if (rule.notification_type && rule.notification_type !== 'custom') {
        const conditionMet = await checkAutoAck(rule.notification_type, rule.linked_entity_id);
        if (conditionMet) {
          await autoAckAndMark(rule.id);
          skipped.push(rule.id);
          continue;
        }
      }

      // ── STOP MECHANISM 1: Max snooze count ──
      const maxSnooze: number = rule.max_snooze_count ?? 10; // default 10 fires
      const currentFireCount = fireCountMap.get(rule.id) ?? 0;
      if (currentFireCount >= maxSnooze) {
        console.log(`[Cron/Notifications] Rule ${rule.id} hit max_snooze_count (${maxSnooze}), auto-acking`);
        await autoAckAndMark(rule.id);
        autoStopped.push(rule.id);
        continue;
      }

      // ── STOP MECHANISM 2: Snooze end time cutoff ──
      if (rule.snooze_end_time) {
        const [endH, endM] = (rule.snooze_end_time as string).split(':').map(Number);
        const endMinuteOfDay = endH * 60 + endM;
        if (currentMinuteOfDay >= endMinuteOfDay) {
          console.log(`[Cron/Notifications] Rule ${rule.id} past snooze_end_time (${rule.snooze_end_time}), auto-acking`);
          await autoAckAndMark(rule.id);
          autoStopped.push(rule.id);
          continue;
        }
      }

      // ── STOP MECHANISM 3: Absolute max window safety net ──
      if (minutesSinceStart > ABSOLUTE_MAX_WINDOW_MINUTES) {
        console.log(`[Cron/Notifications] Rule ${rule.id} exceeded ${ABSOLUTE_MAX_WINDOW_MINUTES}m window, auto-acking`);
        await autoAckAndMark(rule.id);
        autoStopped.push(rule.id);
        continue;
      }

      // Fire at exact start time OR at every snooze interval after start
      const atStartTime = minutesSinceStart === 0;
      const atSnoozeInterval = snoozeInterval > 0 && minutesSinceStart > 0 && minutesSinceStart % snoozeInterval === 0;

      if (!atStartTime && !atSnoozeInterval) {
        skipped.push(rule.id);
        continue;
      }
    } else {
      // Normal: only fire at the exact scheduled minute
      if (minutesSinceStart !== 0) {
        skipped.push(rule.id);
        continue;
      }
    }

    const actionType = (rule.notification_type === 'sleep_wake' || rule.notification_type === 'goal')
      ? 'open_app' : 'yes_no';
    const appUrlMap: Record<string, string> = {
      task: '/tasks',
      habit: '/dashboard',
      goal: '/goals',
      sleep_wake: '/sleep',
    };
    const result = await sendPushNotification(USER_ID, {
      title: rule.title,
      body: rule.body,
      tag: `rule-${rule.id}`,
      ruleId: rule.id,
      actionType,
      actionUrl: `/api/notifications/action?ruleId=${rule.id}`,
      appUrl: appUrlMap[rule.notification_type] || '/dashboard',
    });

    if (result.success) {
      fired.push(rule.id);

      // Increment fire_count for this rule today
      const prevCount = fireCountMap.get(rule.id) ?? 0;
      await supabase.from('notification_acks').upsert(
        {
          rule_id: rule.id,
          user_id: USER_ID,
          acked_date: today,
          fire_count: prevCount + 1,
          // Don't set acked_at â€” that signals actual user acknowledgment
        },
        { onConflict: 'rule_id,acked_date' }
      );
      fireCountMap.set(rule.id, prevCount + 1);
    } else {
      console.warn('[Cron/Notifications] Failed rule', rule.id, result.error);
    }
  }

  console.log(`[Cron/Notifications] ${currentTime} â€“ fired: ${fired.length}, skipped: ${skipped.length}, autoStopped: ${autoStopped.length}`);
  return NextResponse.json({
    time: currentTime,
    fired: fired.length,
    skipped: skipped.length,
    autoStopped: autoStopped.length,
    firedIds: fired,
    autoStoppedIds: autoStopped,
  });
}
