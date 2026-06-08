'use client';

import Link from 'next/link';
import { SyncIndicator } from '@/components/SyncStatus';

export function Header() {
  return (
    <header
      className="glass fixed top-0 left-0 right-0 z-50"
      style={{ borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between h-16 max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-3">
          {/* Wordmark icon â€” a simple diamond/target glyph in gold */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <polygon
              points="10,2 18,10 10,18 2,10"
              stroke="var(--gold)"
              strokeWidth="1.5"
              fill="var(--gold-dim)"
            />
            <circle cx="10" cy="10" r="2.5" fill="var(--gold)" />
          </svg>

          <h1
            className="text-lg tracking-wide"
            style={{
              fontFamily: 'var(--font-family-display)',
              fontStyle: 'italic',
              fontSize: '1.1rem',
              color: 'var(--text)',
              letterSpacing: '0.01em',
            }}
          >
            GoalTracker
          </h1>

          <SyncIndicator />
        </div>

        <Link
          href="/settings"
          className="flex items-center justify-center rounded-full transition-all"
          style={{
            minWidth: '44px',
            minHeight: '44px',
            width: '44px',
            height: '44px',
            background: 'var(--elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
          }}
          aria-label="Settings"
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-hi)';
            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--gold)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
