// Service Worker for Push Notifications
// iOS-compatible with enhanced error handling and logging

const CACHE_NAME = 'goal-tracker-v1';
const NOTIFICATION_TAG = 'goal-tracker';

// Install event - setup cache
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting(); // Activate immediately
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    clients.claim() // Take control of all clients immediately
  );
});

// Push event handler
self.addEventListener('push', function(event) {
  console.log('[SW] Push notification received');
  
  let notificationData = {
    title: 'GoalTracker',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: NOTIFICATION_TAG,
    requireInteraction: false,
    data: {
      url: '/dashboard',
      dateOfArrival: Date.now()
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData,
        data: {
          ...notificationData.data,
          ...(pushData.data || {})
        }
      };
      console.log('[SW] Parsed notification data:', notificationData);
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      // Use default notification data
    }
  }

  // iOS-specific: Ensure icon and badge use PNG format
  notificationData.icon = notificationData.icon || '/icons/icon-192.png';
  notificationData.badge = notificationData.badge || '/icons/icon-192.png';

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: notificationData.vibrate,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: '/icons/icon-192.png'
        },
        {
          action: 'close',
          title: 'Dismiss'
        }
      ]
    }
  );

  event.waitUntil(promiseChain);
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Determine URL to open
  const urlToOpen = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;
  
  console.log('[SW] Opening URL:', urlToOpen);

  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    })
    .then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Focus existing window if found
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          console.log('[SW] Focusing existing window');
          return client.focus().then(() => {
            // Navigate to the URL
            if ('navigate' in client) {
              return client.navigate(urlToOpen);
            }
          });
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        console.log('[SW] Opening new window');
        return clients.openWindow(urlToOpen);
      }
    })
    .catch(err => {
      console.error('[SW] Error handling notification click:', err);
    })
  );
});

// Message handler (for debugging and control)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker loaded successfully');
