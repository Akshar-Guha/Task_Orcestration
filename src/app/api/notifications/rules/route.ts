import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/notifications/rules â€” list all rules for current user
export async function GET() {
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data });
}

// POST /api/notifications/rules â€” create a new rule
export async function POST(request: NextRequest) {
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    title, body: msgBody, schedule_time, repeat_days, is_manual,
    snooze_interval_minutes, notification_type, linked_entity_id, linked_entity_name,
  } = body;

  if (!title?.trim() || !msgBody?.trim()) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notification_rules')
    .insert({
      user_id: userId,
      title: title.trim(),
      body: msgBody.trim(),
      notification_type: notification_type || 'custom',
      linked_entity_id: linked_entity_id || null,
      linked_entity_name: linked_entity_name || null,
      schedule_time: schedule_time || null,
      repeat_days: repeat_days || null,
      is_enabled: true,
      is_manual: !!is_manual,
      snooze_interval_minutes: snooze_interval_minutes || null,
      requires_acknowledgment: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}

