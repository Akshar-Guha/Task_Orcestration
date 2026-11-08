/**
 * Raw Garmin Health API summaries (+ Connect IQ watch fallback) → one day of
 * measured metrics. Field names follow the Garmin Health API summary specs;
 * every read is defensive because Garmin omits fields the device lacks.
 *
 * Precedence per field: Garmin Health API > Connect IQ watch app.
 */
import type { DayMetrics, GarminSummary, RawDay } from './types';
import { localDate, localMinutes, mean, num } from './stats';

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const values = (v: unknown): number[] =>
  Object.values(obj(v)).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));

/** Local date a summary belongs to. */
export function summaryDate(s: GarminSummary, defaultOffset: number): string | null {
  if (typeof s.calendarDate === 'string') return s.calendarDate;
  const start = num(s.startTimeInSeconds);
  if (start == null) return null;
  return localDate(start, num(s.startTimeOffsetInSeconds) ?? defaultOffset);
}

const pickLongest = (xs: GarminSummary[]) =>
  xs.reduce<GarminSummary | null>(
    (best, s) => ((num(s.durationInSeconds) ?? 0) > (num(best?.durationInSeconds) ?? -1) ? s : best),
    null
  );

const mins = (sec: unknown) => (num(sec) != null ? Math.round(num(sec)! / 60) : null);

/** Body Battery value closest after `epoch` from a stressDetails summary. */
function bodyBatteryAfter(details: GarminSummary[], epoch: number): number | null {
  let best: { t: number; v: number } | null = null;
  for (const d of details) {
    const start = num(d.startTimeInSeconds);
    if (start == null) continue;
    for (const [off, v] of Object.entries(obj(d.timeOffsetBodyBatteryValues))) {
      const t = start + Number(off);
      if (typeof v !== 'number' || v < 0 || t < epoch) continue;
      if (!best || t < best.t) best = { t, v };
    }
  }
  return best && best.t - epoch < 3 * 3600 ? best.v : null;
}

export function normalizeDay(raw: RawDay, defaultOffset: number): DayMetrics {
  const sources = new Set<string>();
  const onDay = (xs: GarminSummary[]) => xs.filter((s) => summaryDate(s, defaultOffset) === raw.date);

  /* ─── Sleep ─── */
  const sleep = pickLongest(onDay(raw.sleeps));
  let sleep_start: string | null = null;
  let sleep_end: string | null = null;
  let sleep_minutes: number | null = null;
  let sleep_midpoint_min: number | null = null;
  let sleepStartEpoch: number | null = null;
  let sleepEndEpoch: number | null = null;
  let sleepOffset = defaultOffset;
  if (sleep) {
    sources.add('garmin:sleeps');
    sleepStartEpoch = num(sleep.startTimeInSeconds);
    const dur = num(sleep.durationInSeconds);
    sleepOffset = num(sleep.startTimeOffsetInSeconds) ?? defaultOffset;
    if (sleepStartEpoch != null && dur != null) {
      sleepEndEpoch = sleepStartEpoch + dur;
      sleep_start = new Date(sleepStartEpoch * 1000).toISOString();
      sleep_end = new Date(sleepEndEpoch * 1000).toISOString();
      // Time asleep excludes awake periods
      sleep_minutes = Math.round((dur - (num(sleep.awakeDurationInSeconds) ?? 0)) / 60);
      // Midpoint as minutes from local midnight of the wake date; evening = negative
      const mid = sleepStartEpoch + dur / 2;
      let m = localMinutes(mid, sleepOffset);
      if (localDate(mid, sleepOffset) < raw.date) m -= 1440;
      sleep_midpoint_min = m;
    }
  }
  const scoreObj = obj(sleep?.overallSleepScore);
  const sleep_score = num(scoreObj.value) ?? num(sleep?.sleepScore) ?? null;

  /* ─── Overnight physiology ─── */
  const hrvSummary = onDay(raw.hrv)[0];
  const hrv_night = num(hrvSummary?.lastNightAvg) ?? null;
  if (hrvSummary) sources.add('garmin:hrv');

  const sleepResp = values(sleep?.timeOffsetSleepRespiration);
  let resp_night = sleepResp.length ? mean(sleepResp) : null;
  if (resp_night == null && sleepStartEpoch != null && sleepEndEpoch != null) {
    const inSleep: number[] = [];
    for (const r of raw.respiration) {
      const start = num(r.startTimeInSeconds);
      if (start == null) continue;
      for (const [off, v] of Object.entries(obj(r.timeOffsetEpochToBreaths))) {
        const t = start + Number(off);
        if (typeof v === 'number' && v > 0 && t >= sleepStartEpoch && t <= sleepEndEpoch) inSleep.push(v);
      }
    }
    resp_night = mean(inSleep);
  }

  const sleepSpo2 = values(sleep?.timeOffsetSleepSpo2);
  const dayOx = onDay(raw.pulseox).flatMap((p) => values(p.timeOffsetSpo2Values));
  const spo2_avg = mean(sleepSpo2.length ? sleepSpo2 : dayOx);

  /* ─── Dailies ─── */
  const daily = pickLongest(onDay(raw.dailies));
  if (daily) sources.add('garmin:dailies');
  const mod = num(daily?.moderateIntensityDurationInSeconds);
  const vig = num(daily?.vigorousIntensityDurationInSeconds);

  /* ─── Stress / Body Battery series ─── */
  const details = onDay(raw.stressDetails);
  const stressVals = details.flatMap((d) => values(d.timeOffsetStressLevelValues)).filter((v) => v >= 0);
  const bbVals = details.flatMap((d) => values(d.timeOffsetBodyBatteryValues)).filter((v) => v >= 0);
  if (details.length) sources.add('garmin:stressDetails');

  /* ─── Watch app fallback ─── */
  const ws = raw.watchSamples ?? [];
  const wsVals = (m: string) => ws.filter((s) => s.metric === m).map((s) => s.value);
  const wStress = wsVals('stress');
  const wBB = wsVals('bodyBattery');
  const wHR = wsVals('hr');
  if (ws.length) sources.add('watch:samples');
  if (raw.watchDaily) sources.add('watch:daily');

  const stressSeries = stressVals.length ? stressVals : wStress;
  const bbSeries = bbVals.length ? bbVals : wBB;
  // Stress samples are every 3 min (Garmin) / ~every few min (watch); >75 = high
  const sampleMinutes = stressVals.length ? 3 : 5;

  let bb_at_wake: number | null = null;
  if (sleepEndEpoch != null) {
    bb_at_wake = bodyBatteryAfter(details, sleepEndEpoch);
    if (bb_at_wake == null) {
      const after = ws
        .filter((s) => s.metric === 'bodyBattery' && Date.parse(s.ts) / 1000 >= sleepEndEpoch!)
        .sort((a, b) => a.ts.localeCompare(b.ts))[0];
      bb_at_wake = after?.value ?? null;
    }
  }

  /* ─── Activities ─── */
  const acts = raw.activities
    .filter((a) => summaryDate(a, defaultOffset) === raw.date)
    .map((a) => {
      const start = num(a.startTimeInSeconds) ?? 0;
      const dur = num(a.durationInSeconds) ?? 0;
      return {
        start: new Date(start * 1000).toISOString(),
        minutes: Math.round(dur / 60),
        avgHr: num(a.averageHeartRateInBeatsPerMinute),
        maxHr: num(a.maxHeartRateInBeatsPerMinute),
        type: String(a.activityType ?? 'UNKNOWN'),
        endLocal: localMinutes(start + dur, num(a.startTimeOffsetInSeconds) ?? defaultOffset),
      };
    });
  if (acts.length) sources.add('garmin:activities');

  const vo2 = onDay(raw.userMetrics).map((m) => num(m.vo2Max)).find((v) => v != null) ?? null;

  const maxHrCandidates = [
    num(daily?.maxHeartRateInBeatsPerMinute),
    ...acts.map((a) => a.maxHr),
    wHR.length ? Math.max(...wHR.filter((v) => v < 250)) : null,
  ].filter((v): v is number => v != null && v > 0);

  const wd = raw.watchDaily;

  return {
    date: raw.date,
    sleep_start,
    sleep_end,
    sleep_minutes,
    deep_minutes: mins(sleep?.deepSleepDurationInSeconds),
    light_minutes: mins(sleep?.lightSleepDurationInSeconds),
    rem_minutes: mins(sleep?.remSleepInSeconds),
    awake_minutes: mins(sleep?.awakeDurationInSeconds),
    sleep_score,
    sleep_midpoint_min,
    hrv_night,
    rhr: num(daily?.restingHeartRateInBeatsPerMinute),
    resp_night: resp_night != null ? Math.round(resp_night * 10) / 10 : null,
    spo2_avg: spo2_avg != null ? Math.round(spo2_avg * 10) / 10 : null,
    steps: num(daily?.steps) ?? wd?.steps ?? null,
    step_goal: num(daily?.stepsGoal) ?? wd?.step_goal ?? null,
    active_kcal: num(daily?.activeKilocalories) ?? wd?.calories ?? null,
    intensity_minutes:
      mod != null || vig != null
        ? Math.round(((mod ?? 0) + 2 * (vig ?? 0)) / 60)
        : wd?.active_minutes ?? null,
    stress_avg: num(daily?.averageStressLevel) ?? (stressSeries.length ? Math.round(mean(stressSeries)!) : null),
    stress_max: num(daily?.maxStressLevel) ?? (stressSeries.length ? Math.max(...stressSeries) : null),
    high_stress_minutes:
      mins(daily?.highStressDurationInSeconds) ??
      (stressSeries.length ? stressSeries.filter((v) => v > 75).length * sampleMinutes : null),
    bb_high: num(daily?.bodyBatteryHighestValue) ?? (bbSeries.length ? Math.max(...bbSeries) : null),
    bb_low: num(daily?.bodyBatteryLowestValue) ?? (bbSeries.length ? Math.min(...bbSeries) : null),
    bb_charged: num(daily?.bodyBatteryChargedValue),
    bb_drained: num(daily?.bodyBatteryDrainedValue),
    bb_at_wake,
    vo2max: vo2,
    max_hr_observed: maxHrCandidates.length ? Math.max(...maxHrCandidates) : null,
    late_activity: acts.length ? acts.some((a) => a.endLocal >= 20 * 60) : null,
    activities: acts.map(({ endLocal: _e, ...a }) => { void _e; return a; }),
    sources: [...sources],
  };
}
