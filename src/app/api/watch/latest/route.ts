import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/user';
import { isPinValid } from '@/lib/garmin';

/** GET (header x-site-pin) → latest watch readings + today's totals */
export async function GET(request: NextRequest) {
  if (!isPinValid(request.headers.get('x-site-pin'))) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }
  const userId = getCurrentUserId();
  const supabase = getSupabaseAdmin();

  const latest: Record<string, { ts: string; value: number } | null> = {};
  await Promise.all(
    ['hr', 'stress', 'bodyBattery', 'spo2'].map(async (metric) => {
      const { data } = await supabase
        .from('watch_samples')
        .select('ts, value')
        .eq('user_id', userId)
        .eq('metric', metric)
        .order('ts', { ascending: false })
        .limit(1);
      latest[metric] = data?.[0] ?? null;
    })
  );

  const { data: daily } = await supabase
    .from('watch_daily')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1);

  return NextResponse.json({ latest, today: daily?.[0] ?? null });
}
