'use client';

import { useBodyToday } from '@/lib/hooks/useBody';

/**
 * PLAN.md B3 / C1: planned work vs. what the body can do today.
 * One line; turns coral when the plan exceeds capacity.
 */
export function CapacityBar({ plannedMinutes }: { plannedMinutes: number }) {
  const { today } = useBodyToday();
  if (!today || today.capacity_hours == null) return null;

  const capMin = today.capacity_hours * 60;
  const over = plannedMinutes > capMin + 30;
  const pct = Math.min(100, (plannedMinutes / Math.max(capMin, 1)) * 100);
  const ew = today.energy_windows;

  return (
    <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: 'var(--surface)', border: `1px solid ${over ? 'var(--coral)' : 'var(--border)'}` }}>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span style={{ color: 'var(--text)' }}>
          Planned {(plannedMinutes / 60).toFixed(1)}h of {today.capacity_hours}h capacity
        </span>
        {ew && (
          <span className="text-xs" style={{ color: 'var(--text-2)' }}>
            Deep work {ew.peak1[0]}–{ew.peak1[1]}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: over ? 'var(--coral)' : 'var(--jade)' }} />
      </div>
      {over && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--coral)' }}>
          Over today&apos;s capacity (readiness {today.readiness}). Move the lowest-priority tasks to tomorrow.
        </p>
      )}
    </div>
  );
}
