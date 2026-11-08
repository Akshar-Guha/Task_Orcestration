import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/user';
import { disconnect, garminConfig, getConnectionByUser, isPinValid } from '@/lib/garmin';

const LATEST_TYPES = ['dailies', 'sleeps', 'hrv', 'stressDetails', 'pulseox', 'allDayRespiration', 'userMetrics', 'activities'];

/** GET (header x-site-pin) → connection status + latest summary of each type */
export async function GET(request: NextRequest) {
  if (!isPinValid(request.headers.get('x-site-pin'))) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }
  const userId = getCurrentUserId();
  const conn = userId ? await getConnectionByUser(userId) : null;

  const latest: Record<string, unknown> = {};
  const counts: Record<string, number> = {};
  if (conn) {
    const supabase = getSupabaseAdmin();
    await Promise.all(
      LATEST_TYPES.map(async (type) => {
        const { data, count } = await supabase
          .from('garmin_summaries')
          .select('calendar_date, start_time, data', { count: 'exact' })
          .eq('user_id', userId)
          .eq('summary_type', type)
          .order('calendar_date', { ascending: false, nullsFirst: false })
          .order('start_time', { ascending: false, nullsFirst: false })
          .limit(1);
        if (data?.[0]) latest[type] = data[0];
        counts[type] = count ?? 0;
      })
    );
  }

  return NextResponse.json({
    configured: garminConfig().configured,
    connected: !!conn,
    connection: conn
      ? {
          garminUserId: conn.garmin_user_id,
          connectedAt: conn.connected_at,
          lastDataAt: conn.last_data_at,
          permissions: conn.permissions,
        }
      : null,
    counts,
    latest,
  });
}

/** DELETE (header x-site-pin) → deregister from Garmin and remove tokens */
export async function DELETE(request: NextRequest) {
  if (!isPinValid(request.headers.get('x-site-pin'))) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }
  const userId = getCurrentUserId();
  const conn = userId ? await getConnectionByUser(userId) : null;
  if (conn) await disconnect(conn);
  return NextResponse.json({ ok: true });
}
