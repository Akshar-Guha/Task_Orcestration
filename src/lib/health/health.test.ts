/**
 * Run: npm test   (node:test via tsx)
 * Synthetic payloads shaped like Garmin Health API summaries.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHealthDay, correlate, normalizeDay } from './index';
import type { DayContext, HealthDay, RawDay } from './types';
import { addDays, tzOffsetSeconds } from './stats';

const IST = 19800; // +05:30

function epoch(date: string, hhmm: string, offset = IST) {
  return Date.parse(`${date}T${hhmm}:00Z`) / 1000 - offset;
}

function rawDay(date: string, o: Partial<{ hrv: number; rhr: number; resp: number; sleepH: number; stress: number; workoutMin: number; workoutHr: number; workoutEnd: string }> = {}): RawDay {
  const sleepH = o.sleepH ?? 7.5;
  const wake = epoch(date, '06:30');
  const start = wake - sleepH * 3600 - 20 * 60;
  const acts = o.workoutMin
    ? [{
        activityType: 'RUNNING',
        startTimeInSeconds: epoch(date, o.workoutEnd ?? '18:00') - o.workoutMin * 60,
        startTimeOffsetInSeconds: IST,
        durationInSeconds: o.workoutMin * 60,
        averageHeartRateInBeatsPerMinute: o.workoutHr ?? 150,
        maxHeartRateInBeatsPerMinute: (o.workoutHr ?? 150) + 25,
      }]
    : [];
  return {
    date,
    sleeps: [{
      summaryId: `s-${date}`, calendarDate: date, startTimeInSeconds: start, startTimeOffsetInSeconds: IST,
      durationInSeconds: sleepH * 3600 + 20 * 60, awakeDurationInSeconds: 20 * 60,
      deepSleepDurationInSeconds: 5400, lightSleepDurationInSeconds: 14400, remSleepInSeconds: 6000,
      overallSleepScore: { value: 80 }, timeOffsetSleepRespiration: { '0': o.resp ?? 14, '60': o.resp ?? 14 },
      timeOffsetSleepSpo2: { '0': 96, '60': 97 },
    }],
    hrv: [{ calendarDate: date, lastNightAvg: o.hrv ?? 50 }],
    dailies: [{
      calendarDate: date, durationInSeconds: 86400, steps: 9000, stepsGoal: 8000, activeKilocalories: 500,
      moderateIntensityDurationInSeconds: 1200, vigorousIntensityDurationInSeconds: (o.workoutMin ?? 0) * 60,
      restingHeartRateInBeatsPerMinute: o.rhr ?? 58, maxHeartRateInBeatsPerMinute: 178,
      averageStressLevel: o.stress ?? 30, maxStressLevel: 85, highStressDurationInSeconds: 1800,
      bodyBatteryChargedValue: 60, bodyBatteryDrainedValue: 55,
    }],
    stressDetails: [{
      calendarDate: date, startTimeInSeconds: epoch(date, '00:00'), startTimeOffsetInSeconds: IST,
      timeOffsetStressLevelValues: { '0': 20, '180': 40 },
      timeOffsetBodyBatteryValues: { [String(6.5 * 3600 + 300)]: 82, [String(12 * 3600)]: 55 },
    }],
    pulseox: [], respiration: [], userMetrics: [{ calendarDate: date, vo2Max: 48 }], activities: acts, epochs: [],
  };
}

function history(days: number, end: string, over: (i: number) => Parameters<typeof rawDay>[1] = () => ({})) {
  const out: HealthDay[] = [];
  for (let i = days; i >= 1; i--) {
    const d = addDays(end, -i);
    out.push(buildHealthDay(rawDay(d, over(i)), [...out], IST));
  }
  return out;
}

test('normalizes a Garmin day', () => {
  const m = normalizeDay(rawDay('2026-11-08'), IST);
  assert.equal(m.sleep_minutes, 450);
  assert.equal(m.hrv_night, 50);
  assert.equal(m.rhr, 58);
  assert.equal(m.resp_night, 14);
  assert.equal(m.spo2_avg, 96.5);
  assert.equal(m.bb_at_wake, 82);
  assert.equal(m.steps, 9000);
  assert.equal(m.intensity_minutes, 20);
  assert.equal(m.vo2max, 48);
  assert.equal(m.high_stress_minutes, 30);
  assert.ok(m.sleep_midpoint_min != null && m.sleep_midpoint_min > 0 && m.sleep_midpoint_min < 240);
});

test('falls back to Connect IQ watch data when Garmin API has nothing', () => {
  const m = normalizeDay({
    date: '2026-11-08', dailies: [], sleeps: [], hrv: [], stressDetails: [], pulseox: [], respiration: [],
    userMetrics: [], activities: [], epochs: [],
    watchDaily: { steps: 4321, step_goal: 8000, calories: 300, active_minutes: 12, respiration_rate: null },
    watchSamples: [
      { metric: 'stress', ts: '2026-11-08T05:00:00Z', value: 80 },
      { metric: 'stress', ts: '2026-11-08T05:05:00Z', value: 20 },
      { metric: 'bodyBattery', ts: '2026-11-08T05:00:00Z', value: 70 },
      { metric: 'bodyBattery', ts: '2026-11-08T09:00:00Z', value: 40 },
    ],
  }, IST);
  assert.equal(m.steps, 4321);
  assert.equal(m.intensity_minutes, 12);
  assert.equal(m.stress_avg, 50);
  assert.equal(m.bb_high, 70);
  assert.equal(m.bb_low, 40);
  assert.equal(m.high_stress_minutes, 5);
});

test('recovery is ~neutral on a typical day and low after a bad night', () => {
  const hist = history(30, '2026-11-08', (i) => ({ hrv: 50 + (i % 3) - 1, rhr: 58 + (i % 2) }));
  const typical = buildHealthDay(rawDay('2026-11-08'), hist, IST);
  assert.ok(typical.recovery! >= 50 && typical.recovery! <= 80, `typical ${typical.recovery}`);
  const bad = buildHealthDay(rawDay('2026-11-08', { hrv: 35, rhr: 66, sleepH: 4.5 }), hist, IST);
  assert.ok(bad.recovery! < typical.recovery! - 20, `bad ${bad.recovery}`);
  assert.ok(bad.readiness! <= bad.recovery!);
  assert.ok(bad.capacity_hours! < typical.capacity_hours!);
  assert.equal(typical.baseline_days, 30);
});

test('illness flag needs several signals together', () => {
  const hist = history(30, '2026-11-08', (i) => ({ hrv: 50 + (i % 3) - 1, rhr: 58 + (i % 2), resp: 14 + (i % 2) * 0.2 }));
  const one = buildHealthDay(rawDay('2026-11-08', { rhr: 66 }), hist, IST);
  assert.equal(one.illness_flag, false);
  const sick = buildHealthDay(rawDay('2026-11-08', { rhr: 66, hrv: 35, resp: 17 }), hist, IST);
  assert.equal(sick.illness_flag, true);
  assert.equal(sick.insights[0].id, 'illness');
  assert.match(sick.session_advice!, /Rest/);
});

test('sleep debt accumulates and sets an earlier bedtime', () => {
  const rested = history(14, '2026-11-08');
  const short = history(14, '2026-11-08', () => ({ sleepH: 5.5 }));
  const a = buildHealthDay(rawDay('2026-11-08'), rested, IST);
  const b = buildHealthDay(rawDay('2026-11-08', { sleepH: 5.5 }), short, IST);
  assert.ok(b.sleep_debt_minutes! > 400, `debt ${b.sleep_debt_minutes}`);
  assert.ok(a.sleep_debt_minutes! < 60);
  assert.equal(a.energy_windows!.wake, '06:30');
  assert.ok(b.energy_windows!.bedtime < a.energy_windows!.bedtime);
  assert.ok(b.insights.some((i) => i.id === 'sleep-debt'));
});

test('workouts raise strain and fatigue', () => {
  const hist = history(20, '2026-11-08');
  const rest = buildHealthDay(rawDay('2026-11-08'), hist, IST);
  const hard = buildHealthDay(rawDay('2026-11-08', { workoutMin: 90, workoutHr: 165 }), hist, IST);
  assert.ok(hard.strain! > rest.strain! + 5, `${hard.strain} vs ${rest.strain}`);
  assert.ok(hard.strain! <= 21);
  assert.ok(hard.atl! > rest.atl!);
  const late = buildHealthDay(rawDay('2026-11-08', { workoutMin: 40, workoutEnd: '21:30' }), hist, IST);
  assert.equal(late.late_activity, true);
});

test('burnout index rises with stress, falling HRV and dropping completion', () => {
  const end = '2026-11-08';
  const calm = history(30, end);
  const strained = history(30, end, (i) => (i <= 14 ? { stress: 55, hrv: 50 - (14 - i) * 1.2, sleepH: 6 } : {}));
  const ctx = (bad: boolean): DayContext[] =>
    Array.from({ length: 44 }, (_, k) => {
      const i = 44 - k;
      const recent = i <= 14;
      return { date: addDays(end, -i), tasksPlanned: 5, tasksCompleted: bad && recent ? 2 : 4, productiveMinutes: 200, mood: bad && recent ? 2 : 4, diaryText: '' };
    });
  const a = buildHealthDay(rawDay(end), calm, IST, { today: null, history: ctx(false) });
  const b = buildHealthDay(rawDay(end, { stress: 55, hrv: 33, sleepH: 6 }), strained, IST, { today: null, history: ctx(true) });
  assert.ok(a.burnout_index! < 30, `calm ${a.burnout_index}`);
  assert.ok(b.burnout_index! >= 65, `strained ${b.burnout_index}`);
  assert.ok(b.insights.some((i) => i.id === 'burnout'));
});

test('correlations find a behaviour that hurts next-day HRV', () => {
  const end = '2026-11-08';
  const days: HealthDay[] = [];
  const ctx: DayContext[] = [];
  for (let i = 30; i >= 0; i--) {
    const d = addDays(end, -i);
    const drankYesterday = (i + 1) % 3 === 0;
    days.push(buildHealthDay(rawDay(d, { hrv: drankYesterday ? 40 : 52 }), [...days], IST));
    ctx.push({ date: d, tasksPlanned: 4, tasksCompleted: 3, productiveMinutes: 180, mood: 4, diaryText: i % 3 === 0 ? 'Had some wine with dinner' : 'Normal day' });
  }
  const res = correlate(days, ctx);
  const alc = res.find((r) => r.behaviour === 'alcohol' && r.outcome === 'hrv');
  assert.ok(alc, JSON.stringify(res.slice(0, 3)));
  assert.ok(alc!.effect < -8);
  assert.match(alc!.sentence, /Alcohol costs you/);
});

test('timezone offset helper', () => {
  assert.equal(tzOffsetSeconds('Asia/Kolkata', new Date('2026-11-08T00:00:00Z')), 19800);
  assert.equal(tzOffsetSeconds('UTC'), 0);
});
