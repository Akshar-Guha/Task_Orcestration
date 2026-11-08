import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Guard: only allow Vercel cron runner or callers with the cron secret
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fix: remove hardcoded UUID fallback — fail loudly if env var is missing
  const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_USER_ID;
  if (!FALLBACK_USER_ID) {
    console.error('[Cron/NightEmail] NEXT_PUBLIC_USER_ID not configured');
    return NextResponse.json({ error: 'User ID not configured' }, { status: 500 });
  }

  try {
    // Trigger sleep email
    // Inject user_id for context
    // B4/C3: bedtime target, sleep debt, today's strain (optional block)
    const health = await import('@/lib/health-email').then(mod => mod.getNightHealth(FALLBACK_USER_ID));
    await import('@/lib/emailTrigger').then(mod =>
      mod.triggerEmail('sleep', { user_id: FALLBACK_USER_ID, ...(health ? { health } : {}) })
    );

    return NextResponse.json({ success: true, triggered: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
