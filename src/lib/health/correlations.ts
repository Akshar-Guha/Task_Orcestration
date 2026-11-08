/**
 * Behaviour → next-day outcome correlations (PLAN.md A7, C5, C6).
 * Only plain statistics on the user's own history; no LLMs.
 */
import type { DayContext, HealthDay } from './types';
import { mean, pearson } from './stats';
import { addDays } from './stats';

export interface Correlation {
  behaviour: string;
  outcome: string;
  /** Mean outcome on days after the behaviour minus days without it */
  effect: number;
  r: number | null;
  nWith: number;
  nWithout: number;
  sentence: string;
}

type Flag = (h: HealthDay | undefined, c: DayContext | undefined) => boolean | null;

const kw = (re: RegExp): Flag => (_h, c) => (c ? re.test(c.diaryText) : null);

/** Behaviours observed on day d */
const BEHAVIOURS: Record<string, { label: string; test: Flag }> = {
  alcohol: { label: 'Alcohol', test: kw(/\b(alcohol|beer|wine|drinks?|drank|whisk(e)?y|vodka|cocktail|party)\b/i) },
  caffeine_late: { label: 'Late caffeine', test: kw(/\b(late|evening|night)\b.{0,20}\b(coffee|caffeine|espresso|tea)\b/i) },
  screens_late: { label: 'Late screens', test: kw(/\b(scroll(ed|ing)?|netflix|youtube|instagram|gaming|screen)\b.{0,30}\b(late|night|bed)\b/i) },
  late_workout: { label: 'Workout after 20:00', test: (h) => (h ? h.late_activity === true : null) },
  workout: { label: 'Workout', test: (h) => (h ? (h.intensity_minutes ?? 0) >= 30 : null) },
  short_sleep: { label: 'Under 7h sleep', test: (h) => (h?.sleep_minutes != null ? h.sleep_minutes < 420 : null) },
  high_stress: { label: '2h+ high stress', test: (h) => (h?.high_stress_minutes != null ? h.high_stress_minutes >= 120 : null) },
  steps_goal: { label: 'Hit step goal', test: (h) => (h?.steps != null && h.step_goal ? h.steps >= h.step_goal : null) },
};

/** Outcomes measured on day d+1 */
const OUTCOMES: Record<string, { label: string; unit: string; get: (h?: HealthDay, c?: DayContext) => number | null }> = {
  hrv: { label: 'HRV', unit: ' ms', get: (h) => h?.hrv_night ?? null },
  recovery: { label: 'recovery', unit: ' pts', get: (h) => h?.recovery ?? null },
  productive: { label: 'productive time', unit: ' min', get: (_h, c) => c?.productiveMinutes ?? null },
  completion: {
    label: 'task completion',
    unit: '%',
    get: (_h, c) => (c && c.tasksPlanned ? Math.round((100 * c.tasksCompleted) / c.tasksPlanned) : null),
  },
  mood: { label: 'mood', unit: '/5', get: (_h, c) => c?.mood ?? null },
};

export function correlate(days: HealthDay[], context: DayContext[], minEach = 4): Correlation[] {
  const H = new Map(days.map((d) => [d.date, d]));
  const C = new Map(context.map((d) => [d.date, d]));
  const dates = [...new Set([...H.keys(), ...C.keys()])].sort();
  const out: Correlation[] = [];

  for (const [bKey, b] of Object.entries(BEHAVIOURS)) {
    for (const [oKey, o] of Object.entries(OUTCOMES)) {
      if (bKey === 'short_sleep' && oKey === 'recovery') continue; // tautological
      const withV: number[] = [];
      const withoutV: number[] = [];
      const pairs: [number, number][] = [];
      for (const d of dates) {
        const flag = b.test(H.get(d), C.get(d));
        const next = addDays(d, 1);
        const v = o.get(H.get(next), C.get(next));
        if (flag == null || v == null) continue;
        (flag ? withV : withoutV).push(v);
        pairs.push([flag ? 1 : 0, v]);
      }
      if (withV.length < minEach || withoutV.length < minEach) continue;
      const effect = Math.round((mean(withV)! - mean(withoutV)!) * 10) / 10;
      const r = pearson(pairs);
      if (r == null || Math.abs(r) < 0.25) continue;
      const dir = effect < 0 ? 'costs you' : 'adds';
      out.push({
        behaviour: bKey,
        outcome: oKey,
        effect,
        r: Math.round(r * 100) / 100,
        nWith: withV.length,
        nWithout: withoutV.length,
        sentence: `${b.label} ${dir} ${Math.abs(effect)}${o.unit} of next-day ${o.label} (${withV.length} vs ${withoutV.length} days).`,
      });
    }
  }
  return out.sort((a, b) => Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0));
}
