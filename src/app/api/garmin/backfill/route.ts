import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/user';
import { BACKFILL_TYPES, getConnectionByUser, isPinValid, requestBackfill } from '@/lib/garmin';

/** POST { pin, days? } → asks Garmin to re-send history (arrives via webhook) */
export async function POST(request: NextRequest) {
  const { pin, days } = await request.json().catch(() => ({}));
  if (!isPinValid(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

  const conn = await getConnectionByUser(getCurrentUserId());
  if (!conn) return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });

  const n = Math.max(1, Math.min(Number(days) || 30, 90));
  const results = await Promise.all(BACKFILL_TYPES.map((t) => requestBackfill(conn, t, n)));
  return NextResponse.json({ days: n, results });
}
