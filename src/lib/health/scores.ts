/**
 * Derived scores (PLAN.md Part A). Deterministic, personal-baseline based,
 * no LLMs. Inputs: today's measured metrics, previous processed days
 * (oldest → newest) and work/life context from the rest of the app.
 */
import type { DayContext, DayMetrics, DayScores, EnergyWindows, HealthDay, Insight } from './types';
import { baseline, clamp, ewma, hhmm, localMinutes, mean, median, sd, slope, z } from './stats';

const DEFAULT_SLEEP_NEED = 450; // 7.5 h until we learn more
const DEFAULT_MAX_HR = 190;

const lastN = <T>(xs: T[], n: number) => xs.slice(Math.max(0, xs.length - n));

/** TRIMP-style load for one workout (Banister). */
export function workoutLoad(minutes: number, avgHr: number | null, restHr: number, maxHr: number): number {
  if (avgHr == null || maxHr <= restHr) return minutes * 0.5;
  const hrr = clamp((avgHr - restHr) / (maxHr - restHr), 0, 1);
  return minutes * hrr * 0.64 * Math.exp(1.92 * hrr);
}

export function trainingLoad(m: DayMetrics, restHr: number, maxHr: number): number {
  const actMinutes = m.activities.reduce((a, x) => a + x.minutes, 0);
  const actLoad = m.activities.reduce((a, x) => a + workoutLoad(x.minutes, x.avgHr, restHr, maxHr), 0);
  const extraIntensity = Math.max(0, (m.intensity_minutes ?? 0) - actMinutes);
  const stepsLoad = (m.steps ?? 0) / 2500;
  return Math.round((actLoad + 0.6 * extraIntensity + stepsLoad) * 10) / 10;
}

/** 0–21 like Whoop: logarithmic so the last points are hard to earn. */
export const strainFromLoad = (load: number) => Math.round(21 * (1 - Math.exp(-load / 150)) * 10) / 10;

export function sleepNeed(prevStrain: number | null, base = DEFAULT_SLEEP_NEED): number {
  const strainAdj = prevStrain != null ? Math.max(0, prevStrain - 10) * 4 : 0;
  return Math.round(base + strainAdj);
}

/** Weighted sum of nightly shortfall over the last 14 nights (recent weighs more). */
export function sleepDebt(nights: { need: number; slept: number | null }[]): number {
  const recent = lastN(nights, 14);
  let debt = 0;
  recent.forEach((n, i) => {
    if (n.slept == null) return;
    const age = recent.length - 1 - i;
    debt += Math.max(0, n.need - n.slept) * Math.pow(0.85, age);
  });
  return Math.round(debt);
}

export function consistency(midpoints: (number | null)[]): number | null {
  const xs = lastN(midpoints, 7).filter((v): v is number => v != null);
  if (xs.length < 3) return null;
  return Math.round(clamp(100 - (sd(xs) ?? 0), 0, 100));
}

interface ComputeInput {
  today: DayMetrics;
  history: HealthDay[];
  context?: { today: DayContext | null; history: DayContext[] };
  /** local UTC offset in seconds (for energy windows) */
  offsetSec: number;
}

export function computeScores({ today, history, context, offsetSec }: ComputeInput): DayScores {
  const h30 = lastN(history, 30);
  const prev = history[history.length - 1] ?? null;

  /* ─── Load / strain / fitness ─── */
  const rhrBase = baseline(h30.map((d) => d.rhr), 3);
  const restHr = today.rhr ?? rhrBase?.mean ?? 60;
  const maxHr = Math.max(
    DEFAULT_MAX_HR - 10,
    ...history.map((d) => d.max_hr_observed ?? 0),
    today.max_hr_observed ?? 0
  ) || DEFAULT_MAX_HR;
  const training_load = trainingLoad(today, restHr, maxHr);
  const strain = strainFromLoad(training_load);
  const ctl = Math.round(ewma(prev?.ctl ?? null, training_load, 42) * 10) / 10;
  const atl = Math.round(ewma(prev?.atl ?? null, training_load, 7) * 10) / 10;
  const tsb = Math.round((ctl - atl) * 10) / 10;

  /* ─── Sleep need / debt / consistency ─── */
  const sleep_need_minutes = sleepNeed(prev?.strain ?? null);
  const nights = [
    ...lastN(history, 13).map((d) => ({ need: d.sleep_need_minutes ?? DEFAULT_SLEEP_NEED, slept: d.sleep_minutes })),
    { need: sleep_need_minutes, slept: today.sleep_minutes },
  ];
  const sleep_debt_minutes = today.sleep_minutes != null || history.length ? sleepDebt(nights) : null;
  const sleep_consistency = consistency([...history.map((d) => d.sleep_midpoint_min), today.sleep_midpoint_min]);

  /* ─── Recovery (A1) ─── */
  const hrvB = baseline(h30.map((d) => d.hrv_night));
  const rhrB = baseline(h30.map((d) => d.rhr));
  const respB = baseline(h30.map((d) => d.resp_night), 5, 0.03);
  const spo2B = baseline(h30.map((d) => d.spo2_avg), 5, 0.01);
  const zH = z(today.hrv_night, hrvB);
  const zR = z(today.rhr, rhrB);
  const zResp = z(today.resp_night, respB);
  const zOx = z(today.spo2_avg, spo2B);

  const comps: [number, number][] = [];
  if (zH != null) comps.push([0.45, clamp(zH, -3, 3)]);
  if (zR != null) comps.push([0.25, -clamp(zR, -3, 3)]);
  if (zResp != null) comps.push([0.1, -clamp(zResp, -3, 3)]);
  const wSum = comps.reduce((a, c) => a + c[0], 0);
  const phys = wSum ? comps.reduce((a, c) => a + c[0] * c[1], 0) / wSum : null;
  const physScore = phys != null ? 50 + 20 * clamp(phys, -2.5, 2.5) : null;

  const sleepPerf =
    today.sleep_minutes != null ? clamp(today.sleep_minutes / sleep_need_minutes, 0, 1.1) : null;
  const sleepComp = today.sleep_score ?? (sleepPerf != null ? sleepPerf * 85 : null);

  let recovery: number | null = null;
  if (physScore != null) {
    recovery = sleepComp != null ? 0.7 * physScore + 0.3 * sleepComp : physScore;
  } else {
    const fallback = [sleepComp, today.bb_at_wake].filter((v): v is number => v != null);
    if (fallback.length) recovery = mean(fallback);
  }
  if (recovery != null) recovery = Math.round(clamp(recovery, 0, 100));
  const baseline_days = Math.max(hrvB?.n ?? 0, rhrB?.n ?? 0);

  /* ─── Illness early warning (A4) ─── */
  let illness_score: number | null = null;
  let illness_flag = false;
  if (baseline_days >= 10) {
    const signals = [
      zR != null && zR > 1.5 ? zR : 0,
      zH != null && zH < -1.5 ? -zH : 0,
      zResp != null && zResp > 1.5 ? zResp : 0,
      zOx != null && zOx < -1.5 ? -zOx : 0,
    ];
    illness_score = Math.round(signals.reduce((a, b) => a + b, 0) * 10) / 10;
    illness_flag = signals.filter((s) => s > 0).length >= 2 && illness_score >= 3.5;
  }

  /* ─── Readiness + capacity ─── */
  let readiness: number | null = null;
  if (recovery != null) {
    const debtPenalty = Math.min(15, ((sleep_debt_minutes ?? 0) / 60) * 4);
    readiness = Math.round(clamp(recovery - debtPenalty - (illness_flag ? 20 : 0), 0, 100));
  }
  const capacity_hours =
    readiness != null ? clamp(Math.round((2 + 6 * (readiness / 100) - (illness_flag ? 2 : 0)) * 2) / 2, 1, 8) : null;

  /* ─── Burnout risk (A5) — health + work context ─── */
  const burnout_index = burnout(today, history, context, sleep_debt_minutes);

  /* ─── Energy schedule (A3) ─── */
  const energy_windows = energyWindows(today, history, offsetSec, sleep_need_minutes, sleep_debt_minutes ?? 0);

  /* ─── Session advice (C4) ─── */
  let session_advice: string | null = null;
  if (illness_flag) session_advice = 'Rest day. Your body shows signs of fighting something.';
  else if (readiness != null && readiness >= 70 && tsb > -10)
    session_advice = 'Green light for a hard session: intervals or heavy strength.';
  else if (readiness != null && readiness >= 45)
    session_advice = 'Moderate day: 30–45 min steady zone-2 cardio.';
  else if (readiness != null) session_advice = 'Recovery only: walk, mobility or yoga.';

  const scores: DayScores = {
    training_load,
    strain,
    ctl,
    atl,
    tsb,
    sleep_need_minutes,
    sleep_debt_minutes,
    sleep_consistency,
    recovery,
    readiness,
    capacity_hours,
    illness_score,
    illness_flag,
    burnout_index,
    energy_windows,
    session_advice,
    insights: [],
    baseline_days,
  };
  scores.insights = buildInsights(today, scores, { zH, tsb });
  return scores;
}

function burnout(
  today: DayMetrics,
  history: HealthDay[],
  context: ComputeInput['context'],
  debt: number | null
): number | null {
  const h14 = [...lastN(history, 13), today];
  if (h14.length < 7) return null;
  const parts: [number, number][] = [];

  const stress14 = h14.map((d) => d.stress_avg).filter((v): v is number => v != null);
  const stressB = baseline(lastN(history, 60).map((d) => d.stress_avg), 14);
  if (stress14.length >= 5) {
    const m = mean(stress14)!;
    const s = stressB ? clamp(((m - stressB.mean) / stressB.sd + 0.5) / 2.5, 0, 1) : clamp((m - 25) / 40, 0, 1);
    parts.push([0.25, s]);
  }
  if (debt != null) parts.push([0.2, clamp(debt / 600, 0, 1)]);

  const hrvs = h14.map((d) => d.hrv_night);
  const hrvMean = mean(hrvs.filter((v): v is number => v != null));
  const hs = slope(hrvs);
  if (hs != null && hrvMean) parts.push([0.2, clamp((-hs / hrvMean) * 100, 0, 1)]);

  if (context) {
    const all = [...context.history, ...(context.today ? [context.today] : [])];
    const rate = (xs: DayContext[]) => {
      const planned = xs.reduce((a, d) => a + d.tasksPlanned, 0);
      return planned ? xs.reduce((a, d) => a + d.tasksCompleted, 0) / planned : null;
    };
    const recent = rate(lastN(all, 14));
    const prior = rate(all.slice(Math.max(0, all.length - 44), Math.max(0, all.length - 14)));
    if (recent != null && prior != null) parts.push([0.2, clamp((prior - recent) / 0.4, 0, 1)]);
    const moods = lastN(all, 14).map((d) => d.mood).filter((v): v is number => v != null);
    if (moods.length >= 3) parts.push([0.15, clamp((3.5 - mean(moods)!) / 2, 0, 1)]);
  }

  const w = parts.reduce((a, p) => a + p[0], 0);
  if (w < 0.4) return null;
  return Math.round((100 * parts.reduce((a, p) => a + p[0] * p[1], 0)) / w);
}

function energyWindows(
  today: DayMetrics,
  history: HealthDay[],
  offsetSec: number,
  need: number,
  debt: number
): EnergyWindows | null {
  const wakes = [...lastN(history, 13), today]
    .map((d) => (d.sleep_end ? localMinutes(Date.parse(d.sleep_end) / 1000, offsetSec) : null))
    .filter((v): v is number => v != null);
  if (!wakes.length) return null;
  const wake = median(wakes)!;
  const bedtime = wake - need - Math.min(60, debt / 3) - 15;
  return {
    wake: hhmm(wake),
    peak1: [hhmm(wake + 150), hhmm(wake + 300)],
    dip: [hhmm(wake + 420), hhmm(wake + 540)],
    peak2: [hhmm(wake + 600), hhmm(wake + 720)],
    bedtime: hhmm(bedtime),
  };
}

function buildInsights(m: DayMetrics, s: DayScores, extra: { zH: number | null; tsb: number }): Insight[] {
  const out: Insight[] = [];
  const h = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;

  if (s.illness_flag)
    out.push({
      id: 'illness',
      priority: 100,
      title: 'Your body may be fighting something',
      body: 'Resting heart rate, HRV and breathing are off your normal range. Lighten today and sleep early.',
    });
  if (s.burnout_index != null && s.burnout_index >= 65)
    out.push({
      id: 'burnout',
      priority: 90,
      title: `Burnout risk is high (${s.burnout_index})`,
      body: 'Stress, sleep debt and task completion have been trending the wrong way for two weeks. Protect a recovery day this week.',
    });
  if (s.readiness != null && s.readiness < 45)
    out.push({
      id: 'low-readiness',
      priority: 80,
      title: `Low readiness (${s.readiness})`,
      body: `Plan about ${s.capacity_hours}h of focused work and move the hardest task to tomorrow.`,
    });
  if (s.sleep_debt_minutes != null && s.sleep_debt_minutes >= 120)
    out.push({
      id: 'sleep-debt',
      priority: 70,
      title: `Sleep debt ${h(s.sleep_debt_minutes)}`,
      body: s.energy_windows ? `Aim for bed by ${s.energy_windows.bedtime} tonight.` : 'Aim for an earlier night.',
    });
  if (extra.tsb < -25)
    out.push({
      id: 'fatigue',
      priority: 65,
      title: 'Training fatigue is building',
      body: 'Your 7-day load is well above your fitness. Take an easy day to absorb it.',
    });
  if (m.high_stress_minutes != null && m.high_stress_minutes >= 120)
    out.push({
      id: 'stress',
      priority: 60,
      title: `${h(m.high_stress_minutes)} of high stress`,
      body: 'Schedule short breaks between blocks today.',
    });
  if (m.bb_at_wake != null && m.bb_at_wake < 40)
    out.push({
      id: 'low-bb',
      priority: 55,
      title: `Woke with Body Battery ${m.bb_at_wake}`,
      body: s.energy_windows ? `A 20-min nap around ${s.energy_windows.dip[0]} will help.` : 'A short afternoon nap will help.',
    });
  if (m.late_activity && extra.zH != null && extra.zH < -1)
    out.push({
      id: 'late-workout',
      priority: 50,
      title: 'Late workouts are costing you HRV',
      body: 'Last night’s HRV dropped after an evening session. Try finishing workouts before 20:00.',
    });
  if (s.sleep_consistency != null && s.sleep_consistency < 50)
    out.push({
      id: 'consistency',
      priority: 45,
      title: 'Irregular sleep schedule',
      body: s.energy_windows ? `Keep wake-up near ${s.energy_windows.wake} every day, weekends included.` : 'Keep a fixed wake-up time.',
    });
  if (s.readiness != null && s.readiness >= 75)
    out.push({
      id: 'high-readiness',
      priority: 40,
      title: `High readiness (${s.readiness})`,
      body: s.energy_windows
        ? `Do your hardest task in your peak window ${s.energy_windows.peak1[0]}–${s.energy_windows.peak1[1]}.`
        : 'Good day to tackle your hardest task.',
    });
  return out.sort((a, b) => b.priority - a.priority);
}
