/**
 * Health blocks for the morning / night emails (PLAN.md B4, C3).
 * Deterministic numbers + rule-generated text only; nothing here is sent to an LLM.
 */
import type { HealthDay } from '@/lib/health';
import { getHealthDays, localToday } from '@/lib/health-server';

export interface MorningHealthPayload {
  date: string;
  readiness: number | null;
  recovery: number | null;
  capacity_hours: number | null;
  session_advice: string | null;
  top_insight: { title: string; body: string } | null;
  peak_window: [string, string] | null;
  second_peak_window: [string, string] | null;
  sleep: {
    minutes: number | null;
    score: number | null;
    debt_minutes: number | null;
    need_minutes: number | null;
  };
  illness_flag: boolean;
}

export interface NightHealthPayload {
  date: string;
  bedtime: string | null;
  wake: string | null;
  sleep_debt_minutes: number | null;
  sleep_need_minutes: number | null;
  strain: number | null;
  steps: number | null;
  high_stress_minutes: number | null;
}

async function todayHealth(userId: string): Promise<HealthDay | null> {
  const days = await getHealthDays(userId, 1);
  const d = days[days.length - 1];
  return d && d.date === localToday() ? d : null;
}

export function morningPayload(d: HealthDay): MorningHealthPayload {
  const top = [...(d.insights ?? [])].sort((a, b) => b.priority - a.priority)[0];
  return {
    date: d.date,
    readiness: d.readiness,
    recovery: d.recovery,
    capacity_hours: d.capacity_hours,
    session_advice: d.session_advice,
    top_insight: top ? { title: top.title, body: top.body } : null,
    peak_window: d.energy_windows?.peak1 ?? null,
    second_peak_window: d.energy_windows?.peak2 ?? null,
    sleep: {
      minutes: d.sleep_minutes,
      score: d.sleep_score,
      debt_minutes: d.sleep_debt_minutes,
      need_minutes: d.sleep_need_minutes,
    },
    illness_flag: d.illness_flag === true,
  };
}

export function nightPayload(d: HealthDay): NightHealthPayload {
  return {
    date: d.date,
    bedtime: d.energy_windows?.bedtime ?? null,
    wake: d.energy_windows?.wake ?? null,
    sleep_debt_minutes: d.sleep_debt_minutes,
    sleep_need_minutes: d.sleep_need_minutes,
    strain: d.strain,
    steps: d.steps,
    high_stress_minutes: d.high_stress_minutes,
  };
}

/** Today's morning health block, or null if no health data for today. Never throws. */
export async function getMorningHealth(userId: string): Promise<MorningHealthPayload | null> {
  try {
    const d = await todayHealth(userId);
    return d ? morningPayload(d) : null;
  } catch (e) {
    console.error('[HealthEmail] morning health failed', e);
    return null;
  }
}

/** Today's night health block, or null if no health data for today. Never throws. */
export async function getNightHealth(userId: string): Promise<NightHealthPayload | null> {
  try {
    const d = await todayHealth(userId);
    return d ? nightPayload(d) : null;
  } catch (e) {
    console.error('[HealthEmail] night health failed', e);
    return null;
  }
}
