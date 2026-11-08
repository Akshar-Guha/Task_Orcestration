import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/user';
import { localToday, processHealthFrom } from '@/lib/health-server';
import { watchKeyOk } from '@/lib/watch-auth';

/**
 * POST /api/watch/ingest — called every 5 minutes by the Garmin watch app
 * (garmin-watch/). Auth: header x-watch-key must equal WATCH_INGEST_KEY.
 *
 * Body: {
 *   device, sentAt (epoch s), info: { steps, stepGoal, calories, distanceCm, activeMinutes, ... },
 *   hr|stress|bodyBattery|spo2: [[epochSeconds, value], ...]
 * }
 */
const METRICS = ['hr', 'stress', 'bodyBattery', 'spo2'] as const;

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function POST(request: NextRequest) {
  if (!watchKeyOk(request.headers.get('x-watch-key'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'User not configured' }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const device = typeof body.device === 'string' ? body.device.slice(0, 40) : null;
  const supabase = getSupabaseAdmin();

  // Time series
  const rows: { user_id: string; metric: string; ts: string; value: number; device: string | null }[] = [];
  for (const metric of METRICS) {
    const samples = Array.isArray(body[metric]) ? body[metric] : [];
    for (const s of samples.slice(0, 500)) {
      if (!Array.isArray(s)) continue;
      const t = n(s[0]);
      const v = n(s[1]);
      // Garmin uses sentinel values (e.g. 255 / negative) for "no reading"
      if (t == null || v == null || v < 0 || (metric === 'hr' && v >= 255)) continue;
      rows.push({ user_id: userId, metric, ts: new Date(t * 1000).toISOString(), value: v, device });
    }
  }
  if (rows.length) {
    const { error } = await supabase
      .from('watch_samples')
      .upsert(rows, { onConflict: 'user_id,metric,ts', ignoreDuplicates: true });
    if (error) {
      console.error('[Watch] samples insert failed', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Daily totals. Date in the user's timezone (watch sends epoch; app is IST)
  const info = body.info && typeof body.info === 'object' ? body.info : null;
  if (info) {
    const sentAt = n(body.sentAt) ?? Date.now() / 1000;
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.USER_TIMEZONE || 'Asia/Kolkata',
    }).format(new Date(sentAt * 1000));
    const distanceCm = n(info.distanceCm);
    const { error } = await supabase.from('watch_daily').upsert({
      user_id: userId,
      date,
      steps: n(info.steps),
      step_goal: n(info.stepGoal),
      calories: n(info.calories),
      distance_m: distanceCm != null ? distanceCm / 100 : null,
      active_minutes: n(info.activeMinutes),
      floors_climbed: n(info.floorsClimbed),
      respiration_rate: n(info.respirationRate),
      time_to_recovery_h: n(info.timeToRecoveryHours),
      device,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[Watch] daily upsert failed', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Keep today's health_day fresh (cheap: one day)
  if (rows.length || info) {
    await processHealthFrom(userId, localToday()).catch((e) => console.error('[Watch] health processing failed', e));
  }

  return NextResponse.json({ ok: true, samples: rows.length });
}
