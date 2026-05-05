'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DiaryNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/diary', label: 'Entries', match: '/diary' },
    { href: '/diary/calendar', label: 'Calendar', match: '/diary/calendar' },
    { href: '/diary/stats', label: 'Stats', match: '/diary/stats' },
    { href: '/diary/search', label: 'Search', match: '/diary/search' },
  ];

  return (
    <nav
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}
    >
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          <Link
            href="/dashboard"
            className="px-3 py-3 text-sm whitespace-nowrap transition-colors"
            style={{
              color: 'var(--text-2)',
              fontFamily: 'var(--font-family-body)',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
          >
            &larr; Dashboard
          </Link>
          <div
            className="h-4 w-px mx-1"
            style={{ background: 'var(--border)' }}
          />
          {navItems.map((item) => {
            const isActive =
              pathname === item.match || pathname?.startsWith(item.match + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  fontFamily: 'var(--font-family-body)',
                  color: isActive ? 'var(--gold)' : 'var(--text-2)',
                  borderBottom: isActive
                    ? '2px solid var(--gold)'
                    : '2px solid transparent',
                  letterSpacing: '0.02em',
                }}
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
