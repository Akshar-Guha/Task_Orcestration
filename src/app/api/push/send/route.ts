import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import webpush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// VAPID keys - checked at runtime, not build time
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// Initialize web-push lazily (only when actually sending)
let vapidConfigured = false;
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  
  try {
    webpush.setVapidDetails(
      'mailto:notifications@goal-tracker-web.vercel.app',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
    return true;
  } catch (error) {
    console.error('[Push Send] VAPID configuration failed:', error);
    return false;
  }
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

// POST /api/push/send - Send push notification to user's devices
export async function POST(request: NextRequest) {
  try {
    const { title, body, icon, url, userId: targetUserId } = await request.json();
    const requestingUserId = getCurrentUserId();

    // Use target user ID or fall back to requesting user
    const userId = targetUserId || requestingUserId;

    if (!userId) {
      return NextResponse.json({ error: 'User not specified' }, { status: 400 });
    }

    if (!title || !body) {
      return NextResponse.json({ error: 'Title and body required' }, { status: 400 });
    }

    // Configure VAPID lazily (first request only)
    if (!ensureVapidConfigured()) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('web_push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('[Push Send] Error fetching subscriptions:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No push subscriptions found for user',
        sent: 0 
      });
    }

    // Prepare notification payload
    const payload: NotificationPayload = {
      title,
      body,
      icon: icon || '/icons/icon-192.png',
      url: url || '/dashboard',
      tag: `goal-tracker-${Date.now()}`
    };

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
          return { success: true, endpoint: sub.endpoint };
        } catch (error: unknown) {
          const err = error as { statusCode?: number };
          console.error('[Push Send] Failed to send to endpoint:', sub.endpoint, error);
          
          // Remove invalid/expired subscriptions
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from('web_push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
            console.log('[Push Send] Removed expired subscription:', sub.endpoint);
          }
          
          return { success: false, endpoint: sub.endpoint, error: String(error) };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`[Push Send] Sent ${successful}/${results.length} notifications to user ${userId}`);

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: results.length
    });
  } catch (error) {
    console.error('[Push Send] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
