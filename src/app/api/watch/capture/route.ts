import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/user';
import { watchAuthorized } from '@/lib/watch-auth';

/**
 * POST /api/watch/capture — quick-capture preset from the watch (PLAN.md B9 → A7).
 * Body: { kind: 'idea'|'low_energy'|'distracted'|'break'|'win', hr?, stress?, bodyBattery?, note?, ts? }
 * ts = epoch seconds when it was captured (the watch queues captures while the
 * phone is away); ignored unless within the last 24 h. Defaults to now.
 * Response: { ok: true, id }
 */
const KINDS = new Set(['idea', 'low_energy', 'distracted', 'break', 'win']);

/** Garmin uses negative / 255 sentinels for "no reading". */
const reading = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < max ? v : null;

export async function POST(request: NextRequest) {
  if (!watchAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'User not configured' }, { status: 500 });

  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (typeof kind !== 'string' || !KINDS.has(kind)) {
    return NextResponse.json({ error: `kind must be one of ${[...KINDS].join(', ')}` }, { status: 400 });
  }

  const nowMs = Date.now();
  const tsMs = typeof body.ts === 'number' && Number.isFinite(body.ts) ? body.ts * 1000 : NaN;
  const ts = tsMs <= nowMs + 60_000 && tsMs >= nowMs - 24 * 3600_000 ? new Date(tsMs) : new Date(nowMs);

  const { data, error } = await getSupabaseAdmin()
    .from('watch_captures')
    .insert({
      user_id: userId,
      ts: ts.toISOString(),
      kind,
      hr: reading(body.hr, 255),
      stress: reading(body.stress, 101),
      body_battery: reading(body.bodyBattery, 101),
      note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 280) : null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[Watch/Capture] insert failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
