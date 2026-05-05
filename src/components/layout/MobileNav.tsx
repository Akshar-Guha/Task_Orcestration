'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ─── SVG icon set ───────────────────────────────────────────────────── */
function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconTarget({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMoon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}

function IconBook({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  );
}

/* ─── Nav config ─────────────────────────────────────────────────────── */
const NAV = [
  { href: '/dashboard', label: 'Home',   Icon: IconHome   },
  { href: '/goals',     label: 'Goals',  Icon: IconTarget },
  { href: '/create',    label: '',       Icon: IconPlus,  isCreate: true },
  { href: '/sleep',     label: 'Sleep',  Icon: IconMoon   },
  { href: '/diary',     label: 'Diary',  Icon: IconBook   },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 glass border-t"
      style={{ borderColor: 'var(--border)', paddingBottom: 'var(--safe-b)' }}
    >
      <div
        className="flex items-center justify-around mx-auto"
        style={{ height: 'var(--nav-h)', maxWidth: 480 }}
      >
        {NAV.map(({ href, label, Icon, isCreate }) => {
          const active = pathname === href;

          if (isCreate) {
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-center rounded-full
                           transition-all duration-150 active:scale-90 -mt-5"
                style={{
                  width:      52,
                  height:     52,
                  background: `linear-gradient(135deg, var(--gold) 0%, #A07230 100%)`,
                  boxShadow:  '0 4px 20px var(--gold-glow)',
                  color:      '#060B11',
                }}
              >
                <Icon />
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1
                         transition-all duration-150 active:scale-95 flex-1 py-2"
              style={{ color: active ? 'var(--gold)' : 'var(--text-3)' }}
            >
              <Icon active={active} />
              <span
                className="text-[10px] tracking-wide"
                style={{
                  fontFamily: 'var(--font-family-body)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </span>
              {active && (
                <span
                  className="absolute bottom-1 w-1 h-1 rounded-full"
                  style={{ background: 'var(--gold)' }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
