import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateNudges, type NudgeState, type Sample } from '../health-nudges';

const NOW = new Date('2026-11-08T09:30:00Z'); // 15:00 IST

function series(minutes: number, step: number, value: (i: number) => number): Sample[] {
  const out: Sample[] = [];
  for (let m = minutes, i = 0; m >= 0; m -= step, i++) {
    out.push({ ts: new Date(NOW.getTime() - m * 60_000).toISOString(), value: value(i) });
  }
  return out;
}

function state(over: Partial<NudgeState> = {}): NudgeState {
  return {
    now: NOW,
    localMinute: 15 * 60,
    stress: series(50, 5, () => 30),
    hr: series(15, 5, () => 72),
    bodyBattery: { ts: NOW.toISOString(), value: 60 },
    typicalBodyBattery: null,
    remainingDailyTasks: 3,
    today: { illness_flag: false, illness_score: 0 },
    recentlySent: new Set(),
    ...over,
  };
}

const kinds = (s: NudgeState) => evaluateNudges(s).map((n) => n.kind).sort();

test('calm afternoon sends nothing', () => {
  assert.deepEqual(kinds(state()), []);
});

test('45 min of high stress sends a break nudge', () => {
  assert.deepEqual(kinds(state({ stress: series(50, 5, () => 78) })), ['stress_break']);
});

test('no stress nudge outside 08:00–22:00 or during a workout', () => {
  assert.deepEqual(kinds(state({ stress: series(50, 5, () => 78), localMinute: 23 * 60 })), []);
  assert.deepEqual(kinds(state({ stress: series(50, 5, () => 78), hr: series(15, 2, () => 140) })), []);
});

test('low Body Battery before 18:00 suggests moving tasks, only when tasks remain', () => {
  assert.deepEqual(kinds(state({ bodyBattery: { ts: NOW.toISOString(), value: 18 } })), ['low_battery']);
  assert.deepEqual(kinds(state({ bodyBattery: { ts: NOW.toISOString(), value: 18 }, remainingDailyTasks: 0 })), []);
});

test('dedupe suppresses a kind sent recently', () => {
  assert.deepEqual(kinds(state({ stress: series(50, 5, () => 78), recentlySent: new Set(['stress_break']) })), []);
});

test('illness day produces the quiet-day notice', () => {
  assert.ok(kinds(state({ today: { illness_flag: true, illness_score: 5 } })).includes('quiet_day'));
});
