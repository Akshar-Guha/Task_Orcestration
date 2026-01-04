'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { id: 'database', label: 'Database', icon: '🗄️', href: '/settings/database' },
  { id: 'agent', label: 'Agent Mode', icon: '🤖', href: '/settings/agent-mode' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', href: '/settings/notifications' },
  { id: 'status', label: 'System Status', icon: '⚡', href: '/settings/system-status' },
  { id: 'profile', label: 'Profile', icon: '👤', href: '/settings/profile' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-500">Configure your Goal Tracker system</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const isActive = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
