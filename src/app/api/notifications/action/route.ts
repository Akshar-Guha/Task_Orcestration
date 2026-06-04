import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = process.env.NEXT_PUBLIC_USER_ID || '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

/**
 * POST /api/notifications/action
 * Body: { ruleId: string, action: 'yes' | 'no' }
 *
 * 'yes': performs the in-app action tied to this rule's notification_type,
 *        then acks for today so the alarm stops.
 * 'no':  does nothing — cron will re-fire at next snooze interval.
 */
export async function POST(request: NextRequest) {
  let ruleId = request.nextUrl.searchParams.get('ruleId');
  let action = request.nextUrl.searchParams.get('action') as 'yes' | 'no' | null;

  try {
    const body = await request.json().catch(() => ({}));
    ruleId = ruleId || body.ruleId;
    action = action || body.action;
  } catch {
    // query params already extracted
  }

  if (!ruleId) return NextResponse.json({ error: 'ruleId required' }, { status: 400 });

  if (action === 'no') {
    return NextResponse.json({ ok: true, message: 'Snoozed — will re-fire' });
  }

  // Fetch rule to know what action to perform
  const { data: rule, error: ruleErr } = await supabase
    .from('notification_rules')
    .select('notification_type, linked_entity_id')
    .eq('id', ruleId)
    .eq('user_id', USER_ID)
    .single();

  if (ruleErr || !rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  const today = new Date().toISOString().split('T')[0];
  const entityId = rule.linked_entity_id;

  // Perform in-app action based on type
  switch (rule.notification_type) {
    case 'task': {
      if (!entityId) break;
      // Upsert daily_task_status — marks task complete for today
      await supabase.from('daily_task_status').upsert(
        { task_id: entityId, user_id: USER_ID, date: today, is_completed: true, completed_at: new Date().toISOString() },
        { onConflict: 'task_id,date,user_id' }
      );
      // Also mark the task itself complete
      await supabase
        .from('tasks')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', entityId)
        .eq('user_id', USER_ID);
      break;
    }
    case 'habit': {
      if (!entityId) break;
      // Insert habit completion (ignore conflict if already logged today)
      const { data: existing } = await supabase
        .from('habit_completions')
        .select('id')
        .eq('habit_id', entityId)
        .eq('user_id', USER_ID)
        .gte('completed_at', `${today}T00:00:00Z`)
        .limit(1);
      if (!existing?.length) {
        await supabase.from('habit_completions').insert({
          habit_id: entityId,
          user_id: USER_ID,
          completed_at: new Date().toISOString(),
        });
      }
      break;
    }
    case 'goal': {
      if (!entityId) break;
      await supabase
        .from('goals')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', entityId)
        .eq('user_id', USER_ID);
      break;
    }
    // sleep_wake and custom: just ack, no DB write needed
  }

  // Ack notification for today — stops alarm re-firing
  const { error: ackErr } = await supabase.from('notification_acks').upsert(
    { rule_id: ruleId, user_id: USER_ID, acked_date: today },
    { onConflict: 'rule_id,acked_date' }
  );

  if (ackErr) {
    console.error('[NotifAction] Ack failed:', ackErr);
    return NextResponse.json({ error: ackErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type: rule.notification_type });
}
