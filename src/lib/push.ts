/**
 * Push Notification Utilities
 * Handles service worker registration and push subscriptions
 */

// VAPID public key (from .env)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Convert base64url VAPID key to Uint8Array
 * Handles URL-safe base64 encoding used by VAPID keys
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Trim any whitespace
  const cleanString = base64String.trim();
  
  // Calculate proper padding
  const padding = '='.repeat((4 - (cleanString.length % 4)) % 4);
  
  // Convert from base64url to base64
  const base64 = (cleanString + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  try {
    // Decode base64 string
    const rawData = atob(base64);
    
    // Convert to Uint8Array
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    console.log('[Push] VAPID key converted, length:', outputArray.length);
    return outputArray;
  } catch (error) {
    console.error('[Push] Failed to decode VAPID key:', error);
    console.error('[Push] Key length:', cleanString.length);
    console.error('[Push] Base64 after conversion:', base64);
    throw new Error('Invalid VAPID public key format');
  }
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Push] Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('[Push] Service Worker registration failed:', error);
      return null;
    }
  }
  console.warn('[Push] Service Workers not supported');
  return null;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Push] Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Notification permission:', permission);
  return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
    });

    console.log('[Push] Push subscription created:', subscription);
    return subscription;
  } catch (error) {
    console.error('[Push] Failed to subscribe to push:', error);
    return null;
  }
}

/**
 * Get existing push subscription
 */
export async function getPushSubscription(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  return await registration.pushManager.getSubscription();
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const success = await subscription.unsubscribe();
    console.log('[Push] Unsubscribed:', success);
    return success;
  }
  return false;
}

/**
 * Save subscription to backend
 */
export async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Failed to save subscription:', error);
    return false;
  }
}

/**
 * Full setup: register SW, request permission, subscribe, save
 */
export async function setupPushNotifications(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  // Check if VAPID key is configured
  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: 'VAPID public key not configured' };
  }

  // Register service worker
  const registration = await registerServiceWorker();
  if (!registration) {
    return { success: false, error: 'Service worker registration failed' };
  }

  // Request permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return { success: false, error: `Permission denied: ${permission}` };
  }

  // Subscribe to push
  const subscription = await subscribeToPush(registration);
  if (!subscription) {
    return { success: false, error: 'Push subscription failed' };
  }

  // Save to backend
  const saved = await saveSubscription(subscription);
  if (!saved) {
    return { success: false, error: 'Failed to save subscription to backend' };
  }

  return { success: true, subscription };
}
