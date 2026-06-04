'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { id: 'database',      label: 'Database',      icon: '🗄️',  href: '/settings/database' },
  { id: 'agent',         label: 'Agent Mode',    icon: '🤖',  href: '/settings/agent-mode' },
  { id: 'notifications', label: 'Notifications', icon: '🔔',  href: '/settings/notifications' },
  { id: 'status',        label: 'System Status', icon: '⚡',  href: '/settings/system-status' },
  { id: 'profile',       label: 'Profile',       icon: '👤',  href: '/settings/profile' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--bg)',
        paddingBottom: 'calc(var(--nav-h) + var(--safe-b) + 1rem)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1
            className="text-2xl font-semibold mb-1"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-family-display)', fontStyle: 'italic' }}
          >
            Settings
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Configure your Goal Tracker system
          </p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4">
          {tabs.map((tab) => {
            const isActive = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap"
                style={{
                  background: isActive ? 'var(--gold-dim)' : 'var(--surface)',
                  color: isActive ? 'var(--gold)' : 'var(--text-2)',
                  border: `1px solid ${isActive ? 'var(--gold)' : 'var(--border)'}`,
                  fontFamily: 'var(--font-family-body)',
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}