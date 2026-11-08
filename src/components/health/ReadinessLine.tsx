'use client';

import Link from 'next/link';
import { useBodyToday } from '@/lib/hooks/useBody';

/** PLAN.md Part D rule 2: one number + one sentence on the dashboard. */
export function readinessColor(score: number | null | undefined) {
  if (score == null) return 'var(--text-3)';
  if (score >= 67) return 'var(--jade)';
  if (score >= 34) return 'var(--gold)';
  return 'var(--coral)';
}

export function ReadinessLine() {
  const { today } = useBodyToday();
  if (!today || today.readiness == null) return null;

  const top = today.insights?.[0];
  const sentence = top
    ? top.body
    : today.capacity_hours != null
      ? `Plan about ${today.capacity_hours}h of focused work.${today.energy_windows ? ` Peak ${today.energy_windows.peak1[0]}–${today.energy_windows.peak1[1]}.` : ''}`
      : today.session_advice ?? '';

  return (
    <Link href="/sleep" className="block mb-4">
      <div
        className="flex items-center gap-4 px-4 py-3 rounded-2xl transition-all active:scale-[0.99]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="text-center flex-shrink-0">
          <div
            className="text-3xl leading-none"
            style={{ color: readinessColor(today.readiness), fontFamily: 'var(--font-family-display)', fontStyle: 'italic' }}
          >
            {today.readiness}
          </div>
          <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'var(--text-3)' }}>
            Ready
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
            {top?.title ?? (today.illness_flag ? 'Take it easy today' : `${today.capacity_hours ?? '–'}h focus capacity`)}
          </p>
          <p className="text-xs line-clamp-2" style={{ color: 'var(--text-2)' }}>
            {sentence}
          </p>
        </div>
      </div>
    </Link>
  );
}
