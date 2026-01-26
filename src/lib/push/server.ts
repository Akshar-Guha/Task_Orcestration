import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize Supabase with Service Role for admin access (fetching any user's subs)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  
  try {
    webpush.setVapidDetails(
      'mailto:notifications@goal-tracker-web.vercel.app',
      VAPID_PUBLIC_KEY.trim(),
      VAPID_PRIVATE_KEY.trim()
    );
    vapidConfigured = true;
    return true;
  } catch (error) {
    console.error('[Push Lib] VAPID configuration failed:', error);
    return false;
  }
}

export interface SendPushResult {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  error?: string;
  details?: { endpoint: string; success: boolean; error?: string }[];
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; icon?: string; url?: string; tag?: string }
): Promise<SendPushResult> {
  if (!ensureVapidConfigured()) {
    return { success: false, sent: 0, failed: 0, total: 0, error: 'VAPID keys not configured' };
  }

  // Get user's push subscriptions
  const { data: subscriptions, error: fetchError } = await supabase
    .from('web_push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (fetchError) {
    console.error('[Push Lib] Error fetching subscriptions:', fetchError);
    return { success: false, sent: 0, failed: 0, total: 0, error: fetchError.message };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { success: false, sent: 0, failed: 0, total: 0, error: 'No push subscriptions found' };
  }

  // Prepare full payload
  const notificationPayload = {
    ...payload,
    icon: payload.icon || '/icons/icon-192.png',
    url: payload.url || '/dashboard',
    tag: payload.tag || `goal-tracker-${Date.now()}`
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
        await webpush.sendNotification(pushSubscription, JSON.stringify(notificationPayload));
        return { success: true, endpoint: sub.endpoint };
      } catch (error: any) {
        console.error('[Push Lib] Failed to send to endpoint:', sub.endpoint, error);
        
        // Remove invalid/expired subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase
            .from('web_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
          console.log('[Push Lib] Removed expired subscription:', sub.endpoint);
        }
        
        return { success: false, endpoint: sub.endpoint, error: String(error) };
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;
  const details = results.map(r => r.status === 'fulfilled' ? r.value : { success: false, endpoint: 'unknown', error: 'Promise rejected' });

  return {
    success: successful > 0,
    sent: successful,
    failed,
    total: results.length,
    details
  };
}
