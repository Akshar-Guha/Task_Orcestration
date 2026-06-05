import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? '';

/** Returns today's date in the user's configured timezone, falling back to UTC. */
async function getUserToday(userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_settings')
    .select('timezone')
    .eq('user_id', userId)
    .single();
  const tz = data?.timezone || process.env.USER_TIMEZONE || 'UTC';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

// POST /api/notifications/ack?ruleId=xxx
// Called from the app OR from the service worker action button
// Marks the alarm as acknowledged for today — stops snooze firing
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('ruleId');

  // Also accept ruleId in body
  let bodyRuleId: string | undefined;
  try {
    const body = await request.json();
    bodyRuleId = body?.ruleId;
  } catch {
    // no body
  }

  const id = ruleId || bodyRuleId;
  if (!id) return NextResponse.json({ error: 'ruleId required' }, { status: 400 });

  const userId = getCurrentUserId() || USER_ID;
  if (!userId) return NextResponse.json({ error: 'User not configured' }, { status: 500 });
  const today = await getUserToday(userId);

  const { error } = await supabase
    .from('notification_acks')
    .upsert(
      { rule_id: id, user_id: userId, acked_date: today, acked_at: new Date().toISOString() },
      { onConflict: 'rule_id,acked_date' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, ackedDate: today });
}

// GET /api/notifications/ack?ruleId=xxx — check if already acked today
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('ruleId');
  if (!ruleId) return NextResponse.json({ error: 'ruleId required' }, { status: 400 });

  const userId = getCurrentUserId() || USER_ID;
  if (!userId) return NextResponse.json({ error: 'User not configured' }, { status: 500 });
  const today = await getUserToday(userId);

  const { data } = await supabase
    .from('notification_acks')
    .select('id')
    .eq('rule_id', ruleId)
    .eq('user_id', userId)
    .eq('acked_date', today)
    .maybeSingle();

  return NextResponse.json({ acknowledged: !!data });
}