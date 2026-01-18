'use client';

import { ReactNode, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Header } from './Header';
import { MobileNav } from './MobileNav';



interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { trackInteraction } = useAppStore();

  useEffect(() => {
    // Throttled activity tracker
    let lastUpdate = 0;
    const THROTTLE_MS = 60000; // Update max once per minute to avoid spamming store

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > THROTTLE_MS) {
        trackInteraction();
        lastUpdate = now;
      }
    };

    // Listen for common user interactions
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Initial update on mount
    trackInteraction();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [trackInteraction]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100">
      <Header />
      <main className="pt-16 pb-28 px-4 max-w-lg mx-auto scroll-container">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
