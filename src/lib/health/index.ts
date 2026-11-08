import type { DayContext, HealthDay, RawDay } from './types';
import { normalizeDay } from './normalize';
import { computeScores } from './scores';

export * from './types';
export { normalizeDay, summaryDate } from './normalize';
export { computeScores } from './scores';
export { correlate } from './correlations';
export { addDays, tzOffsetSeconds, hhmm } from './stats';

/** Pure: raw feeds + processed history → the health_day row for `raw.date`. */
export function buildHealthDay(
  raw: RawDay,
  history: HealthDay[],
  offsetSec: number,
  context?: { today: DayContext | null; history: DayContext[] }
): HealthDay {
  const metrics = normalizeDay(raw, offsetSec);
  const scores = computeScores({ today: metrics, history, context, offsetSec });
  const { activities: _a, ...measured } = metrics;
  void _a;
  return { ...measured, ...scores };
}
