import { NextResponse } from 'next/server';
import { addDays } from '@/lib/health';
import { getHealthDays, localToday, processHealthFrom } from '@/lib/health-server';
import { BACKFILL_TYPES, getConnectionByUser, requestBackfill } from '@/lib/garmin';

export const maxDuration = 60;

/**
 * Nightly (PLAN.md B1/B8): recompute the last 3 days (late Garmin revisions,
 * baselines, fitness/fatigue) and request a backfill when sleep is missing.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = process.env.NEXT_PUBLIC_USER_ID;
  if (!userId) return NextResponse.json({ error: 'User ID not configured' }, { status: 500 });

  const today = localToday();
  const days = await processHealthFrom(userId, addDays(today, -3));

  // Gap check: any of the last 7 nights without sleep data → ask Garmin again
  let backfill: unknown = null;
  const conn = await getConnectionByUser(userId);
  if (conn) {
    const recent = await getHealthDays(userId, 8);
    const missing = Array.from({ length: 7 }, (_, i) => addDays(today, -i - 1)).filter(
      (d) => !recent.some((r) => r.date === d && r.sleep_minutes != null)
    );
    if (missing.length) {
      backfill = await Promise.all(BACKFILL_TYPES.slice(0, 4).map((t) => requestBackfill(conn, t, 8)));
    }
  }

  return NextResponse.json({ ok: true, processed: days.length, backfill });
}
