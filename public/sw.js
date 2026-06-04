// Service Worker for Push Notifications
// iOS-compatible with enhanced error handling and logging

const CACHE_NAME = 'goal-tracker-v1';
const NOTIFICATION_TAG = 'goal-tracker';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(clients.claim());
});

// Push event handler
self.addEventListener('push', function(event) {
  console.log('[SW] Push notification received');

  let data = {
    title: 'GoalTracker',
    body: 'You have a reminder',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [300, 100, 300, 100, 300],
    tag: NOTIFICATION_TAG,
    requireInteraction: true,
    actionType: 'yes_no',
    actionUrl: null,
    appUrl: '/dashboard',
    ruleId: null,
  };

  if (event.data) {
    try {
      const pushed = event.data.json();
      data = { ...data, ...pushed };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  // Action buttons based on type
  const actions = data.actionType === 'open_app'
    ? [
        { action: 'open', title: '📱 Open App' },
        { action: 'later', title: '⏰ Later' },
      ]
    : [
        { action: 'done', title: '✅ Done' },
        { action: 'later', title: '⏰ Later' },
      ];

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-192.png',
      vibrate: data.vibrate,
      tag: data.tag,
      requireInteraction: true,
      renotify: true,
      actions,
      data: {
        actionType: data.actionType,
        actionUrl: data.actionUrl,
        appUrl: data.appUrl,
        ruleId: data.ruleId,
      },
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  const { actionType, actionUrl, appUrl } = event.notification.data || {};

  // "Done" / "Yes" — perform action + ack
  if (event.action === 'done') {
    if (actionUrl) {
      event.waitUntil(
        fetch(new URL(actionUrl + '&action=yes', self.location.origin).href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'yes' }),
        })
          .then(() => console.log('[SW] Action completed'))
          .catch(err => console.error('[SW] Action failed:', err))
      );
    }
    return;
  }

  // "Later" — just close, cron re-fires at next snooze interval
  if (event.action === 'later') {
    return;
  }

  // "Open App" button or tapping notification body
  const urlToOpen = new URL(appUrl || '/dashboard', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => {
              if ('navigate' in client) return client.navigate(urlToOpen);
            });
          }
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      })
      .catch(err => console.error('[SW] Error opening window:', err))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

console.log('[SW] Service Worker loaded successfully');
