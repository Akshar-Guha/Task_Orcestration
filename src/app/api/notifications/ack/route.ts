import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const USER_ID = process.env.NEXT_PUBLIC_USER_ID || '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

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

  const today = new Date().toISOString().split('T')[0];

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
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('notification_acks')
    .select('id')
    .eq('rule_id', ruleId)
    .eq('user_id', userId)
    .eq('acked_date', today)
    .maybeSingle();

  return NextResponse.json({ acknowledged: !!data });
}
