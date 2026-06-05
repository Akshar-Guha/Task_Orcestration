﻿import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { sendPushNotification } from '@/lib/push/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Allowed fields that callers may update via PATCH
const PATCHABLE_FIELDS = new Set([
  'title', 'body', 'schedule_time', 'repeat_days', 'is_enabled', 'is_manual',
  'snooze_interval_minutes', 'notification_type', 'linked_entity_id', 'linked_entity_name',
  'requires_acknowledgment',
]);

// PATCH /api/notifications/rules/[id] — update rule (toggle enabled, edit fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rawUpdates: Record<string, unknown>;
  try {
    rawUpdates = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Whitelist: strip any fields that should not be user-settable (user_id, id, created_at, etc.)
  const safeUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawUpdates)) {
    if (PATCHABLE_FIELDS.has(key)) {
      safeUpdates[key] = value;
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notification_rules')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  return NextResponse.json({ rule: data });
}

// DELETE /api/notifications/rules/[id] — remove a rule
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fix: verify the rule exists for this user before deleting (returns 404 instead of silent no-op)
  const { data: existing, error: fetchErr } = await supabase
    .from('notification_rules')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });

  const { error } = await supabase
    .from('notification_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST /api/notifications/rules/[id] — send this rule's notification immediately
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: rule, error: fetchError } = await supabase
    .from('notification_rules')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  const result = await sendPushNotification(userId, {
    title: rule.title,
    body: rule.body,
    tag: `rule-${rule.id}`,
    appUrl: '/dashboard',
  });

  return NextResponse.json(result);
}