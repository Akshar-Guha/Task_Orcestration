import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/user';

// This would need a database table - for now just log
export async function POST(request: NextRequest) {
  try {
    const subscription = await request.json();
    const userId = getCurrentUserId();

    // TODO: Save to database
    // await supabase.from('push_subscriptions').insert({
    //   user_id: userId,
    //   endpoint: subscription.endpoint,
    //   auth: subscription.keys.auth,
    //   p256dh: subscription.keys.p256dh
    // });

    console.log('[API] Push subscription received:', {
      userId,
      endpoint: subscription.endpoint
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error saving push subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
