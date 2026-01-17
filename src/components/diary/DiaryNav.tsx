'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DiaryNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/diary', label: '📔 Entries', match: '/diary' },
    { href: '/diary/calendar', label: '📅 Calendar', match: '/diary/calendar' },
    { href: '/diary/stats', label: '📊 Stats', match: '/diary/stats' },
    { href: '/diary/search', label: '🔍 Search', match: '/diary/search' },
  ];

  return (
    <nav className="border-b border-white/10 bg-black/10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          <Link 
            href="/dashboard"
            className="px-3 py-3 text-white/60 hover:text-white text-sm whitespace-nowrap transition"
          >
            ← Dashboard
          </Link>
          <div className="h-4 w-px bg-white/20 mx-1"></div>
          {navItems.map((item) => {
            const isActive = pathname === item.match || pathname?.startsWith(item.match + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                  isActive
                    ? 'text-purple-400 border-purple-500'
                    : 'text-white/70 border-transparent hover:text-white hover:border-white/20'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
