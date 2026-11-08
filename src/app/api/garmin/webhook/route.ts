import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { addDays, summaryDate } from '@/lib/health';
import { processHealthFrom } from '@/lib/health-server';
import {
  fetchPingCallback,
  getConnectionByGarminUser,
  storeSummaries,
  type GarminConnection,
} from '@/lib/garmin';

/**
 * Single endpoint for every Garmin Health API notification.
 * Point all summary types in the Garmin developer portal's Endpoint
 * Configuration here:  https://<your-app>/api/garmin/webhook
 *
 * Payload shape: { "<summaryType>": [ { userId, summaryId, ... }, ... ] }
 *  - push mode: each item is the full summary
 *  - ping mode: each item is { userId, callbackURL }
 *  - "deregistrations": user disconnected from Garmin's side
 *  - "userPermissionsChange": user changed data-sharing permissions
 *
 * Garmin expects a fast 200, so errors are logged rather than returned.
 */
export const maxDuration = 60;

type Item = Record<string, unknown> & { userId?: string; callbackURL?: string };

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  let body: Record<string, Item[]>;
  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  // Earliest affected local date per app user → recompute health_day from there
  const touched = new Map<string, string>();
  const touch = (userId: string, items: Record<string, unknown>[]) => {
    for (const it of items) {
      const d = summaryDate(it, 19800);
      if (!d) continue;
      const prev = touched.get(userId);
      if (!prev || d < prev) touched.set(userId, d);
    }
  };
  let unknownUsers = 0;
  const connections = new Map<string, GarminConnection | null>();
  const lookup = async (garminUserId: string) => {
    if (!connections.has(garminUserId)) {
      connections.set(garminUserId, await getConnectionByGarminUser(garminUserId));
    }
    return connections.get(garminUserId) ?? null;
  };

  const result: Record<string, number> = {};

  for (const [type, items] of Object.entries(body)) {
    if (!Array.isArray(items)) continue;

    if (type === 'deregistrations') {
      for (const item of items) {
        if (item.userId) {
          await supabase.from('garmin_connections').delete().eq('garmin_user_id', String(item.userId));
        }
      }
      result[type] = items.length;
      continue;
    }

    if (type === 'userPermissionsChange') {
      for (const item of items) {
        if (item.userId && Array.isArray(item.permissions)) {
          await supabase
            .from('garmin_connections')
            .update({ permissions: item.permissions })
            .eq('garmin_user_id', String(item.userId));
        }
      }
      result[type] = items.length;
      continue;
    }

    // Group by Garmin user so each batch is stored under the right connection
    const byUser = new Map<string, Item[]>();
    for (const item of items) {
      const uid = String(item.userId ?? '');
      if (!uid) continue;
      byUser.set(uid, [...(byUser.get(uid) ?? []), item]);
    }

    let stored = 0;
    for (const [garminUserId, userItems] of byUser) {
      const conn = await lookup(garminUserId);
      if (!conn) {
        console.warn(`[Garmin] ${type} for unknown user ${garminUserId}, ignoring`);
        unknownUsers += 1;
        continue;
      }
      try {
        const pushed = userItems.filter((i) => !i.callbackURL);
        stored += await storeSummaries(conn, type, pushed);
        touch(conn.user_id, pushed);

        for (const ping of userItems.filter((i) => i.callbackURL)) {
          const fetched = await fetchPingCallback(conn, String(ping.callbackURL));
          stored += await storeSummaries(conn, type, fetched);
          touch(conn.user_id, fetched);
        }
      } catch (e) {
        console.error(`[Garmin] failed to process ${type}`, e);
      }
    }
    result[type] = stored;
  }

  // Turn raw summaries into health_day + synced app data
  const processed: Record<string, number> = {};
  for (const [userId, from] of touched) {
    try {
      processed[userId] = (await processHealthFrom(userId, addDays(from, -1))).length;
    } catch (e) {
      console.error('[Garmin] health processing failed', e);
    }
  }

  const summary = { stored: result, processed, unknownUsers };
  await supabase
    .from('garmin_webhook_log')
    .insert({ payload: body, result: summary })
    .then(({ error }) => error && console.error('[Garmin] log insert failed', error.message));

  console.log('[Garmin] webhook processed', summary);
  return NextResponse.json({ ok: true, ...summary });
}
