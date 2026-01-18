import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/push/subscribe - Save push subscription to database
export async function POST(request: NextRequest) {
  try {
    const subscription = await request.json();
    const userId = getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Validate subscription data
    if (!subscription.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Upsert subscription to database (update if endpoint exists, insert if new)
    const { data, error } = await supabase
      .from('web_push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        auth: subscription.keys.auth,
        p256dh: subscription.keys.p256dh,
        expiration_time: subscription.expirationTime || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'endpoint'
      })
      .select()
      .single();

    if (error) {
      console.error('[Push API] Error saving subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Push API] Subscription saved:', {
      userId,
      endpoint: subscription.endpoint.substring(0, 50) + '...'
    });

    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    console.error('[Push API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/push/subscribe - Remove subscription
export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();
    const userId = getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { error } = await supabase
      .from('web_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('[Push API] Error deleting subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Push API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
