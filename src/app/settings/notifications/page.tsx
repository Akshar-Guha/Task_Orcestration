'use client';

import { useState, useEffect } from 'react';
import { setupPushNotifications } from '@/lib/push';

// iOS detection
function isIOS() {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

// PWA detection
function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches;
}

export default function NotificationsPage() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [iosDevice, setIosDevice] = useState(false);
  const [standaloneMode, setStandaloneMode] = useState(false);

  const checkSubscriptionStatus = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    }
  };

  useEffect(() => {
    // Check current notification permission
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Check platform
    setIosDevice(isIOS());
    setStandaloneMode(isStandalone());

    // Check if already subscribed
    checkSubscriptionStatus();
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    setMessage('');

    const result = await setupPushNotifications();

    if (result.success) {
      setPermission('granted');
      setIsSubscribed(true);
      setMessage('✅ Push notifications enabled successfully!');
    } else {
      setMessage(`❌ Failed: ${result.error}`);
    }

    setLoading(false);
  };

  const handleTestNotification = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
      });

      if (response.ok) {
        setMessage('✅ Test notification sent! Check your notifications.');
      } else {
        setMessage('❌ Failed to send test notification');
      }
    } catch {
      setMessage('❌ Error sending test notification');
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Push Notifications</h2>
        <p className="text-slate-400">
          Enable notifications to receive reminders for your tasks and goals.
        </p>
      </div>

      {/* iOS-specific warning */}
      {iosDevice && !standaloneMode && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">⚠️ iOS Setup Required</h4>
          <div className="text-xs text-orange-300/80 space-y-2">
            <p><strong>Push notifications on iPhone require the app to be installed as a PWA.</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Tap the <strong>Share</strong> button in Safari (at bottom of screen)</li>
              <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong></li>
              <li>Tap <strong>&quot;Add&quot;</strong> to confirm</li>
              <li>Open the app from your Home Screen</li>
              <li>Return here and enable notifications</li>
            </ol>
          </div>
        </div>
      )}

      {/* Permission Status */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Status</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-300">Browser Permission</div>
              <div className="text-xs text-slate-500 mt-1">
                {permission === 'granted' && '✅ Granted'}
                {permission === 'denied' && '❌ Denied'}
                {permission === 'default' && '⚠️ Not requested yet'}
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              permission === 'granted' 
                ? 'bg-green-500/20 text-green-400'
                : permission === 'denied'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {permission}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-300">Subscription Status</div>
              <div className="text-xs text-slate-500 mt-1">
                {isSubscribed ? '✅ Subscribed to push' : '❌ Not subscribed'}
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isSubscribed
                ? 'bg-green-500/20 text-green-400'
                : 'bg-slate-500/20 text-slate-400'
            }`}>
              {isSubscribed ? 'Active' : 'Inactive'}
            </div>
          </div>

          {/* iOS Diagnostic Info */}
          {iosDevice && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-300">Running as PWA</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {standaloneMode ? '✅ Installed PWA' : '❌ Safari browser mode'}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  standaloneMode
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {standaloneMode ? 'Yes' : 'No'}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-300">Platform</div>
                  <div className="text-xs text-slate-500 mt-1">iOS Device Detected</div>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                  iPhone/iPad
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
        
        <div className="space-y-3">
          {!isSubscribed && (
            <button
              onClick={handleEnableNotifications}
              disabled={loading || (iosDevice && !standaloneMode)}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-medium rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
              title={iosDevice && !standaloneMode ? 'Install PWA first (see instructions above)' : ''}
            >
              {loading ? 'Setting up...' : '🔔 Enable Notifications'}
            </button>
          )}

          {isSubscribed && (
            <div className="space-y-3">
              <button
                onClick={handleTestNotification}
                disabled={loading}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <span>🧪</span>
                {loading ? 'Sending...' : 'Send Test Notification'}
              </button>
              
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    if ('serviceWorker' in navigator) {
                      const reg = await navigator.serviceWorker.getRegistration();
                      const sub = await reg?.pushManager.getSubscription();
                      await sub?.unsubscribe();
                      setIsSubscribed(false);
                      setMessage('✅ Notifications disabled. Click Enable to re-subscribe with new keys.');
                    }
                  } catch (e) {
                    setMessage('❌ Failed to unsubscribe');
                  }
                  setLoading(false);
                }}
                disabled={loading}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-medium rounded-xl disabled:opacity-50 transition-colors"
              >
                Reset / Disable Notifications
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            message.startsWith('✅')
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">ℹ️ About Push Notifications</h4>
        <ul className="text-xs text-blue-300/80 space-y-1">
          <li>• Receive reminders for scheduled tasks</li>
          <li>• Get notifications for goal milestones</li>
          <li>• Morning briefing summaries</li>
          <li>• Works even when the app is closed</li>
          {iosDevice && (
            <li className="font-semibold text-blue-300">• iOS 16.4+ required for Web Push</li>
          )}
        </ul>
      </div>
    </div>
  );
}
