import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
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

export async function POST(request: NextRequest) {
  let body: Record<string, Item[]>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
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
        continue;
      }
      try {
        const pushed = userItems.filter((i) => !i.callbackURL);
        stored += await storeSummaries(conn, type, pushed);

        for (const ping of userItems.filter((i) => i.callbackURL)) {
          const fetched = await fetchPingCallback(conn, String(ping.callbackURL));
          stored += await storeSummaries(conn, type, fetched);
        }
      } catch (e) {
        console.error(`[Garmin] failed to process ${type}`, e);
      }
    }
    result[type] = stored;
  }

  console.log('[Garmin] webhook processed', result);
  return NextResponse.json({ ok: true, stored: result });
}
