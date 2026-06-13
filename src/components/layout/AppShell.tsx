'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { NotificationOverlay, RoutineReviewOverlay } from '@/components/ui';
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
        <NotificationOverlay />
        <RoutineReviewOverlay />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh]" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Header />
      <main className="max-w-lg mx-auto scroll-container page-content" style={{ paddingTop: "var(--header-h)", paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))", paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))" }}>
        {children}
      </main>
      <MobileNav />
      <NotificationOverlay />
      <RoutineReviewOverlay />
    </div>
  );
}

