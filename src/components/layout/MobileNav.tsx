'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Home', icon: '🏠', href: '/dashboard' },
  { label: 'Timeline', icon: '📅', href: '/timeline' },
  { label: 'Diary', icon: '📔', href: '/diary' },
  { label: 'Profile', icon: '👤', href: '/profile' },
  { label: 'Create', icon: '➕', href: '/create' },
  { label: 'Settings', icon: '⚙️', href: '/settings/database' },
];

export function MobileNav() {
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isCreate = item.href === '/create';
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-0.5 px-3 py-2 min-w-[56px] flex-1
                transition-all duration-200 active:scale-95
                ${isCreate ? 'relative -mt-5' : ''}
                ${isActive && !isCreate ? 'text-violet-400' : 'text-slate-400'}
                ${!isActive && !isCreate ? 'hover:text-slate-200 active:text-violet-400' : ''}
              `}
            >
              <span className={`
                text-xl transition-transform duration-200
                ${isCreate ? 'w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30 text-white' : ''}
                ${isActive && !isCreate ? 'scale-110' : ''}
              `}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium tracking-tight ${isCreate ? 'sr-only' : ''}`}>
                {item.label}
              </span>
              {isActive && !isCreate && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-violet-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
