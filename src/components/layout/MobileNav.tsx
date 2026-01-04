'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Home', icon: '🏠', href: '/dashboard' },
  { label: 'Timeline', icon: '📅', href: '/timeline' },
  { label: 'Profile', icon: '👤', href: '/profile' },
  { label: 'Create', icon: '➕', href: '/create' },
  { label: 'Map', icon: '🗺️', href: '/planner' },
];

export function MobileNav() {
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-xl border-t border-white/5">
      <div className="flex items-center justify-around h-16 px-2 max-w-4xl mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isCreate = item.href === '/create';
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-1 px-4 py-2 min-w-0 flex-1
                ${isCreate ? 'relative -mt-6' : ''}
                ${isActive && !isCreate ? 'text-violet-400' : 'text-slate-500'}
                ${!isActive && !isCreate ? 'hover:text-slate-300' : ''}
              `}
            >
              <span className={`
                text-2xl
                ${isCreate ? 'w-14 h-14 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25' : ''}
              `}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium ${isCreate ? 'hidden' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
