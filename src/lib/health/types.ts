/**
 * Shared types for the health pipeline (PLAN.md B1).
 * Everything in src/lib/health is pure (no DB, no Next imports) so it can be
 * unit-tested with real-shaped Garmin payloads.
 */

/** One raw Garmin summary as stored in garmin_summaries.data */
export type GarminSummary = Record<string, unknown>;

export interface RawDay {
  date: string; // YYYY-MM-DD (local)
  dailies: GarminSummary[];
  sleeps: GarminSummary[];
  hrv: GarminSummary[];
  stressDetails: GarminSummary[];
  pulseox: GarminSummary[];
  respiration: GarminSummary[];
  userMetrics: GarminSummary[];
  activities: GarminSummary[];
  epochs: GarminSummary[];
  /** watch_daily row from the Connect IQ app (fallback source) */
  watchDaily?: {
    steps: number | null;
    step_goal: number | null;
    calories: number | null;
    active_minutes: number | null;
    respiration_rate: number | null;
  } | null;
  /** watch_samples (Connect IQ app) for this local day */
  watchSamples?: { metric: string; ts: string; value: number }[];
}

/** Measured (not derived) fields for one day */
export interface DayMetrics {
  date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  sleep_minutes: number | null;
  deep_minutes: number | null;
  light_minutes: number | null;
  rem_minutes: number | null;
  awake_minutes: number | null;
  sleep_score: number | null;
  sleep_midpoint_min: number | null;
  hrv_night: number | null;
  rhr: number | null;
  resp_night: number | null;
  spo2_avg: number | null;
  steps: number | null;
  step_goal: number | null;
  active_kcal: number | null;
  intensity_minutes: number | null;
  stress_avg: number | null;
  stress_max: number | null;
  high_stress_minutes: number | null;
  bb_high: number | null;
  bb_low: number | null;
  bb_charged: number | null;
  bb_drained: number | null;
  bb_at_wake: number | null;
  vo2max: number | null;
  max_hr_observed: number | null;
  late_activity: boolean | null;
  /** Workouts used for training load */
  activities: { start: string; minutes: number; avgHr: number | null; maxHr: number | null; type: string }[];
  sources: string[];
}

export interface Insight {
  id: string;
  priority: number; // higher = more important; dashboard shows the top one
  title: string;
  body: string;
}

export interface EnergyWindows {
  peak1: [string, string];
  dip: [string, string];
  peak2: [string, string];
  bedtime: string;
  wake: string;
}

/** Derived scores for one day */
export interface DayScores {
  training_load: number | null;
  strain: number | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  sleep_need_minutes: number | null;
  sleep_debt_minutes: number | null;
  sleep_consistency: number | null;
  recovery: number | null;
  readiness: number | null;
  capacity_hours: number | null;
  illness_score: number | null;
  illness_flag: boolean;
  burnout_index: number | null;
  energy_windows: EnergyWindows | null;
  session_advice: string | null;
  insights: Insight[];
  baseline_days: number;
}

export type HealthDay = Omit<DayMetrics, 'activities'> & DayScores;

/** Work/life context from the rest of the app, used by burnout + correlations */
export interface DayContext {
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  productiveMinutes: number | null;
  mood: number | null; // 1–5
  diaryText: string;
}
