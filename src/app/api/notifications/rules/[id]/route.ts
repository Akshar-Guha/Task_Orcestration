import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { sendPushNotification } from '@/lib/push/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PATCH /api/notifications/rules/[id] — update rule (toggle enabled, edit fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const updates = await request.json();

  const { data, error } = await supabase
    .from('notification_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

// DELETE /api/notifications/rules/[id] — remove a rule
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('notification_rules')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST /api/notifications/rules/[id] — send this rule's notification immediately
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: rule, error: fetchError } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  const result = await sendPushNotification(userId, {
    title: rule.title,
    body: rule.body,
    icon: rule.icon || undefined,
    appUrl: '/dashboard',
    tag: `rule-${rule.id}`,
  });

  return NextResponse.json(result);
}
