import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Fix: use service-role client for server-side cron reads, not the anon browser client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Guard: only allow Vercel cron runner or callers with the cron secret
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fix: remove hardcoded UUID fallback — fail loudly if env var is missing
  const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_USER_ID;
  if (!FALLBACK_USER_ID) {
    console.error('[Cron/MorningEmail] NEXT_PUBLIC_USER_ID not configured');
    return NextResponse.json({ error: 'User ID not configured' }, { status: 500 });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: log } = await supabase
        .from('sleep_wake_logs')
        .select('*')
        .eq('user_id', FALLBACK_USER_ID)
        .eq('date', today)
        .single();

    const moodMap: Record<number, string> = {
        5: 'great', 4: 'good', 3: 'okay', 2: 'bad', 1: 'terrible'
    };
    const mood = log?.wake_up_mood ? moodMap[log.wake_up_mood] : 'good';

    // We inject user_id into the body so Edge Function knows target (if it supports it)
    // B4: readiness block (optional; edge function renders it only when present)
    const health = await import('@/lib/health-email').then(mod => mod.getMorningHealth(FALLBACK_USER_ID));
    await import('@/lib/emailTrigger').then(mod =>
      mod.triggerEmail('wake-up', { mood, user_id: FALLBACK_USER_ID, ...(health ? { health } : {}) })
    );

    return NextResponse.json({ success: true, triggered: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
