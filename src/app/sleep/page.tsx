'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ManualSleepView } from '@/components/sleep/ManualSleepView';
import { readinessColor } from '@/components/health/ReadinessLine';
import { useBodyPatterns, useBodyToday, useRecordMood, useSleepOverride } from '@/lib/hooks/useBody';
import { useSleepLogs } from '@/lib/hooks/useSupabase';
import { getLocalDateString } from '@/lib/date-utils';
import type { HealthDay } from '@/lib/health';

/* ─── helpers ─────────────────────────────────────────────────────────── */

const hm = (min: number | null | undefined) =>
  min == null ? '–' : `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`;

const fmt = (v: number | null | undefined, digits = 0, unit = '') =>
  v == null ? '–' : `${Number(v).toFixed(digits)}${unit}`;

const clock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '–';

function avg(days: HealthDay[], key: keyof HealthDay): number | null {
  const xs = days.map((d) => d[key]).filter((v): v is number => typeof v === 'number');
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** "▲ 4 vs 30d" style delta */
function Delta({ now, base, digits = 0, invert = false }: { now: number | null; base: number | null; digits?: number; invert?: boolean }) {
  if (now == null || base == null) return null;
  const d = now - base;
  if (Math.abs(d) < Math.pow(10, -digits) / 2) return <span style={{ color: 'var(--text-3)' }}> = 30d</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span style={{ color: good ? 'var(--jade)' : 'var(--coral)' }}>
      {' '}
      {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(digits)}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div className="text-base font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-family-mono)' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{sub}</div>}
    </div>
  );
}

function Section({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="mb-3 rounded-2xl group" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</span>
        <span className="text-xs flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
          {summary}
          <span className="transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">{children}</div>
    </details>
  );
}

/* ─── last night + mood + override ────────────────────────────────────── */

function LastNight({ today }: { today: HealthDay }) {
  const { data: logs = [] } = useSleepLogs();
  const recordMood = useRecordMood();
  const override = useSleepOverride();
  const [editing, setEditing] = useState(false);
  const [bed, setBed] = useState('23:00');
  const [wake, setWake] = useState('07:00');
  const todayLog = logs.find((l) => l.date === getLocalDateString());
  const total = (today.deep_minutes ?? 0) + (today.light_minutes ?? 0) + (today.rem_minutes ?? 0) + (today.awake_minutes ?? 0);
  const stages = [
    { k: 'Deep', v: today.deep_minutes, c: 'var(--sky)' },
    { k: 'Light', v: today.light_minutes, c: 'var(--text-3)' },
    { k: 'REM', v: today.rem_minutes, c: 'var(--gold)' },
    { k: 'Awake', v: today.awake_minutes, c: 'var(--coral)' },
  ];
  const moods = [
    { v: 1, l: 'Awful' }, { v: 2, l: 'Tired' }, { v: 3, l: 'Okay' }, { v: 4, l: 'Good' }, { v: 5, l: 'Great' },
  ];

  return (
    <div className="mb-3 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Last night · from your watch</span>
        <button className="text-xs underline" style={{ color: 'var(--text-2)' }} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Cancel' : 'Correct this'}
        </button>
      </div>

      {today.sleep_minutes == null ? (
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>Waiting for your watch to sync last night&apos;s sleep.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-3xl" style={{ color: 'var(--text)', fontFamily: 'var(--font-family-display)', fontStyle: 'italic' }}>
              {hm(today.sleep_minutes)}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-2)', fontFamily: 'var(--font-family-mono)' }}>
              {clock(today.sleep_start)} → {clock(today.sleep_end)}
            </span>
            {today.sleep_score != null && (
              <span className="text-sm ml-auto" style={{ color: 'var(--text-2)' }}>score {today.sleep_score}</span>
            )}
          </div>
          {total > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden mb-1">
              {stages.map((s) => (
                <div key={s.k} style={{ width: `${((s.v ?? 0) / total) * 100}%`, background: s.c }} />
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="flex items-end gap-2 mt-3">
          <label className="text-xs" style={{ color: 'var(--text-2)' }}>
            Bed
            <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className="block mt-1 px-2 py-1 rounded-lg"
              style={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-2)' }}>
            Wake
            <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="block mt-1 px-2 py-1 rounded-lg"
              style={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </label>
          <button
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold)', color: 'var(--gold)' }}
            onClick={() => override.mutate({ bed, wake }, { onSuccess: () => setEditing(false) })}
          >
            Save
          </button>
        </div>
      )}

      <div className="mt-3">
        <div className="text-xs mb-1.5" style={{ color: 'var(--text-2)' }}>How do you feel?</div>
        <div className="flex gap-1.5">
          {moods.map((m) => {
            const on = todayLog?.wakeUpMood === m.v;
            return (
              <button
                key={m.v}
                onClick={() => recordMood.mutate(m.v)}
                className="flex-1 py-1.5 rounded-lg text-xs transition-all active:scale-95"
                style={{
                  background: on ? 'var(--gold-dim)' : 'var(--elevated)',
                  border: `1px solid ${on ? 'var(--gold)' : 'var(--border)'}`,
                  color: on ? 'var(--gold)' : 'var(--text-2)',
                }}
              >
                {m.l}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── page ────────────────────────────────────────────────────────────── */

export default function BodyPage() {
  const { today, days, hasWatch, isLoading } = useBodyToday();
  const patterns = useBodyPatterns(days);

  if (isLoading) return null;
  if (!hasWatch) return <ManualSleepView />;

  const d = today ?? days[days.length - 1];
  const last30 = days.slice(-31, -1);
  const last7 = days.slice(-7);
  const top = d.insights?.[0];
  const ew = d.energy_windows;

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-family-body)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-5">
          <Link href="/dashboard" aria-label="Back" className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Body</h1>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              {d.date === getLocalDateString() ? 'Today' : `Last synced ${d.date}`} · updates when your watch syncs
            </p>
          </div>
        </div>

        {/* Readiness hero */}
        <div className="mb-3 p-4 rounded-2xl flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-center">
            <div className="text-5xl leading-none" style={{ color: readinessColor(d.readiness), fontFamily: 'var(--font-family-display)', fontStyle: 'italic' }}>
              {d.readiness ?? '–'}
            </div>
            <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: 'var(--text-3)' }}>Readiness</div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {top?.title ?? `${d.capacity_hours ?? '–'}h focus capacity today`}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>{top?.body ?? d.session_advice}</p>
            {d.baseline_days < 14 && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
                Learning your baseline: {d.baseline_days}/14 days. Scores get personal after two weeks.
              </p>
            )}
          </div>
        </div>

        <LastNight today={d} />

        <Section title="Recovery" summary={`${d.recovery ?? '–'} · HRV ${fmt(d.hrv_night)}`}>
          <Stat label="Recovery" value={d.recovery ?? '–'} sub={d.illness_flag ? 'Illness signals detected' : undefined} />
          <Stat label="HRV (night)" value={fmt(d.hrv_night, 0, ' ms')} sub={<>30d {fmt(avg(last30, 'hrv_night'))}<Delta now={d.hrv_night} base={avg(last30, 'hrv_night')} /></>} />
          <Stat label="Resting HR" value={fmt(d.rhr, 0, ' bpm')} sub={<>30d {fmt(avg(last30, 'rhr'))}<Delta now={d.rhr} base={avg(last30, 'rhr')} invert /></>} />
          <Stat label="Breathing" value={fmt(d.resp_night, 1, ' brpm')} sub={<Delta now={d.resp_night} base={avg(last30, 'resp_night')} digits={1} invert />} />
          <Stat label="SpO₂" value={fmt(d.spo2_avg, 1, '%')} />
          <Stat label="Body Battery at wake" value={d.bb_at_wake ?? '–'} />
        </Section>

        <Section title="Sleep" summary={`debt ${hm(d.sleep_debt_minutes)}${ew ? ` · bed ${ew.bedtime}` : ''}`}>
          <Stat label="Need tonight" value={hm(d.sleep_need_minutes)} />
          <Stat label="Sleep debt (14d)" value={hm(d.sleep_debt_minutes)} />
          <Stat label="Bedtime target" value={ew?.bedtime ?? '–'} sub={ew ? `wake ~${ew.wake}` : undefined} />
          <Stat label="Consistency" value={d.sleep_consistency ?? '–'} sub="0–100, same times daily" />
          <Stat label="Energy peak" value={ew ? `${ew.peak1[0]}–${ew.peak1[1]}` : '–'} sub={ew ? `2nd ${ew.peak2[0]}–${ew.peak2[1]}` : undefined} />
          <Stat label="Afternoon dip" value={ew ? `${ew.dip[0]}–${ew.dip[1]}` : '–'} sub="admin, walks, naps" />
          <Stat label="7-night avg" value={hm(avg(last7, 'sleep_minutes'))} />
          <Stat label="Focus capacity" value={d.capacity_hours != null ? `${d.capacity_hours}h` : '–'} />
        </Section>

        <Section title="Strain & fitness" summary={`strain ${fmt(d.strain, 1)} · form ${fmt(d.tsb, 0)}`}>
          <Stat label="Strain today" value={fmt(d.strain, 1)} sub="0–21" />
          <Stat label="Form (TSB)" value={fmt(d.tsb, 0)} sub={d.tsb != null ? (d.tsb < -25 ? 'fatigued' : d.tsb > 5 ? 'fresh' : 'productive') : undefined} />
          <Stat label="Fitness (CTL)" value={fmt(d.ctl, 0)} sub={<Delta now={d.ctl} base={days[0]?.ctl ?? null} />} />
          <Stat label="Fatigue (ATL)" value={fmt(d.atl, 0)} />
          <Stat label="VO₂ max" value={fmt(d.vo2max, 0)} sub={<Delta now={d.vo2max} base={days.find((x) => x.vo2max != null)?.vo2max ?? null} />} />
          <Stat label="Today's session" value={<span className="text-xs font-normal" style={{ fontFamily: 'var(--font-family-body)' }}>{d.session_advice ?? '–'}</span>} />
        </Section>

        <Section title="Stress" summary={`avg ${fmt(d.stress_avg)} · burnout ${d.burnout_index ?? '–'}`}>
          <Stat label="Stress avg" value={fmt(d.stress_avg)} sub={<Delta now={d.stress_avg} base={avg(last30, 'stress_avg')} invert />} />
          <Stat label="High stress" value={hm(d.high_stress_minutes)} />
          <Stat label="Body Battery" value={`${d.bb_low ?? '–'}–${d.bb_high ?? '–'}`} sub="low–high" />
          <Stat label="Burnout risk" value={d.burnout_index ?? '–'} sub="14-day, includes your tasks & mood" />
        </Section>

        {(patterns.data?.length ?? 0) > 0 && (
          <Section title="Your patterns" summary={`${patterns.data!.length} found`}>
            {patterns.data!.map((p) => (
              <div key={`${p.behaviour}-${p.outcome}`} className="col-span-2 text-sm py-1" style={{ color: 'var(--text)' }}>
                {p.sentence}
              </div>
            ))}
          </Section>
        )}

        {(d.insights?.length ?? 0) > 1 && (
          <Section title="Other notes" summary={`${d.insights.length - 1}`}>
            {d.insights.slice(1).map((i) => (
              <div key={i.id} className="col-span-2 text-sm py-1">
                <span style={{ color: 'var(--text)' }}>{i.title}.</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>{i.body}</span>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
