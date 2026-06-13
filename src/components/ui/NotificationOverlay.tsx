'use client';

import { useEffect, useState } from 'react';

interface NotificationRule {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  is_enabled: boolean;
  created_at: string;
}

export function NotificationOverlay() {
  const [activeNotification, setActiveNotification] = useState<NotificationRule | null>(null);

  useEffect(() => {
    // Check for new notifications every 4 seconds
    const checkNotifications = async () => {
      try {
        const res = await fetch('/api/notifications/rules');
        if (!res.ok) return;

        const data = await res.json();
        const rules: NotificationRule[] = data.rules || [];

        // Find the latest active shortcut_output notification
        const latestShortcutOutput = rules.find(
          (rule) => rule.notification_type === 'shortcut_output' && rule.is_enabled
        );

        if (latestShortcutOutput) {
          setActiveNotification(latestShortcutOutput);
        } else {
          setActiveNotification(null);
        }
      } catch (err) {
        console.error('[NotificationOverlay] Error fetching notifications:', err);
      }
    };

    // Run immediately on mount and then poll
    checkNotifications();
    const interval = setInterval(checkNotifications, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async () => {
    if (!activeNotification) return;

    try {
      // Mark the notification as read by disabling it
      const res = await fetch(`/api/notifications/rules/${activeNotification.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: false }),
      });

      if (res.ok) {
        setActiveNotification(null);
      }
    } catch (err) {
      console.error('[NotificationOverlay] Error dismissing notification:', err);
    }
  };

  if (!activeNotification) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: 'rgba(3, 7, 12, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      className="animate-fade-in"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'rgba(11, 22, 34, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border-hi)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 40px var(--gold-glow)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        className="animate-scale-in"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: 'var(--gold)',
              boxShadow: '0 0 10px var(--gold)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-family-display)',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--gold)',
              letterSpacing: '0.025em',
            }}
          >
            {activeNotification.title}
          </span>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-family-body)',
            fontSize: '0.95rem',
            color: 'var(--text)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            maxHeight: '200px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {activeNotification.body}
        </div>

        <button
          onClick={handleAcknowledge}
          style={{
            marginTop: '0.5rem',
            width: '100%',
            height: '44px',
            borderRadius: '8px',
            backgroundColor: 'var(--border-hi)',
            border: '1px solid var(--border-hi)',
            color: 'var(--text)',
            fontFamily: 'var(--font-family-body)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--gold-dim)';
            e.currentTarget.style.borderColor = 'var(--gold)';
            e.currentTarget.style.color = 'var(--gold)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--border-hi)';
            e.currentTarget.style.borderColor = 'var(--border-hi)';
            e.currentTarget.style.color = 'var(--text)';
          }}
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
