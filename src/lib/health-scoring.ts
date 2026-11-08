/**
 * Health-aware scoring helpers (PLAN.md B5). Pure, no DB / Next imports.
 *
 * - Illness-aware streaks: a day where health_day.illness_flag is true is
 *   "frozen": it neither breaks a streak nor adds to it.
 * - Capacity-weighted completion: a 60% day on a low-capacity day can be a
 *   full score. expected = clamp(capacity_hours / 6, 0.3, 1), fallback 1.
 */

export const FULL_CAPACITY_HOURS = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Expected fraction of a "normal" day given the body's capacity (fallback 1). */
export function expectedFromCapacity(capacityHours: number | null | undefined): number {
  if (capacityHours == null || !Number.isFinite(capacityHours)) return 1;
  return clamp(capacityHours / FULL_CAPACITY_HOURS, 0.3, 1);
}

/**
 * Capacity-adjusted score = completion / expected, capped at `scale`.
 * Pass scale 1 for a 0–1 fraction (rounded to 3 dp) or 100 for a percentage
 * (rounded to an integer).
 */
export function adjustedCompletion(completion: number, expected: number, scale: 1 | 100 = 1): number {
  const exp = expected > 0 ? expected : 1;
  const v = Math.min(scale, Math.max(0, completion) / exp);
  return scale === 100 ? Math.round(v) : Math.round(v * 1000) / 1000;
}

export interface StreakResultAware {
  current_streak: number;
  longest_streak: number;
  /** illness days skipped inside the current streak */
  frozen_days: number;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Streak over YYYY-MM-DD dates. Like calculate_diary_streak, the current
 * streak may end today or yesterday (today not done yet is not a break).
 * Frozen (illness) days are skipped: they neither add nor break.
 */
export function illnessAwareStreak(
  activeDates: Iterable<string>,
  frozenDates: Iterable<string>,
  referenceDate: string
): StreakResultAware {
  const active = new Set(activeDates);
  const frozen = new Set(frozenDates);
  for (const d of active) frozen.delete(d);
  if (active.size === 0) return { current_streak: 0, longest_streak: 0, frozen_days: 0 };

  // Current streak
  let current = 0;
  let frozenInCurrent = 0;
  let day = referenceDate;
  if (!active.has(day) && !frozen.has(day)) day = shiftDate(day, -1); // grace for today
  for (let i = 0; i < 3660; i++) {
    if (active.has(day)) current++;
    else if (frozen.has(day)) frozenInCurrent++;
    else break;
    day = shiftDate(day, -1);
  }
  if (current === 0) frozenInCurrent = 0;

  // Longest streak: walk every day from the first active date to the reference
  const sorted = [...active].sort();
  const end = sorted[sorted.length - 1] > referenceDate ? sorted[sorted.length - 1] : referenceDate;
  let longest = 0;
  let run = 0;
  for (let d = sorted[0], i = 0; d <= end && i < 36600; d = shiftDate(d, 1), i++) {
    if (active.has(d)) {
      run++;
      longest = Math.max(longest, run);
    } else if (!frozen.has(d)) {
      run = 0;
    }
  }

  return { current_streak: current, longest_streak: Math.max(longest, current), frozen_days: frozenInCurrent };
}
