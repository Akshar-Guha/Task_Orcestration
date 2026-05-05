'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';



import { usePathname } from 'next/navigation';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  if (isLandingPage) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100 dark">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh]" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Header />
      <main className="pt-16 px-4 max-w-lg mx-auto scroll-container page-content">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
