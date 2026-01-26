import { NextResponse } from 'next/server';
import { triggerSleepEmail } from '@/lib/emailTrigger';

export async function GET() {
  try {
    const FALLBACK_USER_ID = '2c32a446-1bbc-4294-8a29-3e4fef5649e6';
    // Trigger sleep email
    // Inject user_id for context
    await import('@/lib/emailTrigger').then(mod => mod.triggerEmail('sleep', { user_id: FALLBACK_USER_ID }));
    
    return NextResponse.json({ success: true, triggered: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
