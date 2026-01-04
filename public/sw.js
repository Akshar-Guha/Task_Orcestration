// Service Worker for Push Notifications
// Listens for push events and displays notifications

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let notificationData = {
    title: 'MTO Goal Tracker',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      url: '/'
    }
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
    }
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon || '/icon-192.png',
      badge: notificationData.badge || '/badge-72.png',
      vibrate: [200, 100, 200],
      data: notificationData.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ]
    }
  );

  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the app or navigate to specific URL
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Optional: Listen for service worker activation
self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activated');
});
