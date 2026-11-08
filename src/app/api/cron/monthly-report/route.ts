import { NextRequest, NextResponse } from 'next/server';
import { addDays, correlate, type DayContext, type HealthDay } from '@/lib/health';
import type { Correlation } from '@/lib/health/correlations';
import { getHealthDays, localToday } from '@/lib/health-server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/cron/monthly-report — PLAN.md A8 monthly performance report.
 * Vercel cron "0 3 1 * *". Summarises the most recently completed month from
 * health_day (+ A7 correlations) and emails it via Resend.
 * Pure statistics only: no health data is sent to any LLM.
 *
 * Query: ?month=YYYY-MM to (re)send a specific month; ?dry=1 returns the HTML
 * instead of emailing.
 */
export const maxDuration = 60;

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
const avg = (xs: (number | null | undefined)[]) => {
  const v = nums(xs);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const fmt = (v: number | null, digits = 0, unit = '') => (v == null ? '—' : `${v.toFixed(digits)}${unit}`);
const dur = (min: number | null) => {
  if (min == null) return '—';
  const m = Math.round(Math.abs(min));
  return `${min < 0 ? '-' : ''}${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
const signed = (v: number | null, digits = 1, unit = '') =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}${unit}`;

/** First and last non-null value of a field in date order → change. */
function change(days: HealthDay[], key: 'ctl' | 'vo2max'): { from: number | null; to: number | null; delta: number | null } {
  const v = days.map((d) => d[key]).filter((x): x is number => typeof x === 'number');
  if (!v.length) return { from: null, to: null, delta: null };
  return { from: v[0], to: v[v.length - 1], delta: v.length > 1 ? v[v.length - 1] - v[0] : null };
}

function monthRange(month: string): { from: string; to: string; label: string } {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { from, to, label };
}

/** Most recently completed month (or the current one if today is its last day). */
function defaultMonth(today: string): string {
  if (addDays(today, 1).slice(8) === '01') return today.slice(0, 7);
  const [y, m] = today.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

async function buildContext(userId: string, from: string, to: string): Promise<DayContext[]> {
  const db = getSupabaseAdmin();
  const [entries, statuses] = await Promise.all([
    db.from('daily_entries').select('date,mood,summary,wins,challenges').eq('user_id', userId).gte('date', from).lte('date', to),
    db.from('daily_task_status').select('date,is_completed,minutes_spent').eq('user_id', userId).gte('date', from).lte('date', to).limit(10000),
  ]);
  const ctx = new Map<string, DayContext>();
  const get = (date: string) => {
    if (!ctx.has(date)) ctx.set(date, { date, tasksPlanned: 0, tasksCompleted: 0, productiveMinutes: null, mood: null, diaryText: '' });
    return ctx.get(date)!;
  };
  for (const s of statuses.data ?? []) {
    const c = get(s.date);
    c.tasksPlanned += 1;
    if (s.is_completed) c.tasksCompleted += 1;
    c.productiveMinutes = (c.productiveMinutes ?? 0) + (s.minutes_spent ?? 0);
  }
  for (const e of entries.data ?? []) {
    const c = get(e.date);
    c.mood = e.mood;
    c.diaryText = [e.summary, ...(e.wins ?? []), ...(e.challenges ?? [])].filter(Boolean).join(' ');
  }
  return [...ctx.values()];
}

interface Summary {
  days: number;
  readiness: number | null;
  recovery: number | null;
  sleep: number | null;
  debt: number | null;
  strain: number | null;
  hrv: number | null;
  rhr: number | null;
  steps: number | null;
}

function summarise(days: HealthDay[]): Summary {
  return {
    days: days.length,
    readiness: avg(days.map((d) => d.readiness)),
    recovery: avg(days.map((d) => d.recovery)),
    sleep: avg(days.map((d) => d.sleep_minutes)),
    debt: avg(days.map((d) => d.sleep_debt_minutes)),
    strain: avg(days.map((d) => d.strain)),
    hrv: avg(days.map((d) => d.hrv_night)),
    rhr: avg(days.map((d) => d.rhr)),
    steps: avg(days.map((d) => d.steps)),
  };
}

function renderHtml(args: {
  label: string;
  cur: Summary;
  prev: Summary;
  ctl: ReturnType<typeof change>;
  vo2: ReturnType<typeof change>;
  illnessDays: string[];
  best: HealthDay[];
  worst: HealthDay[];
  correlations: Correlation[];
  completion: number | null;
  appUrl: string;
}): string {
  const { label, cur, prev } = args;
  const delta = (a: number | null, b: number | null, digits = 0, unit = '', lowerIsBetter = false) => {
    if (a == null || b == null) return '';
    const d = a - b;
    if (Math.abs(d) < Math.pow(10, -digits) / 2) return '<span style="color:#888;">±0</span>';
    const good = lowerIsBetter ? d < 0 : d > 0;
    return `<span style="color:${good ? '#22c55e' : '#ef4444'};">${signed(d, digits, unit)}</span>`;
  };
  const row = (name: string, value: string, d: string) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #222;">${name}</td><td style="padding:8px;border-bottom:1px solid #222;text-align:right;font-weight:600;">${value}</td><td style="padding:8px;border-bottom:1px solid #222;text-align:right;font-size:12px;">${d}</td></tr>`;
  const dayRow = (d: HealthDay) =>
    `<li>${esc(d.date)}: readiness ${fmt(d.readiness)}, recovery ${fmt(d.recovery)}, sleep ${dur(d.sleep_minutes)}${d.strain != null ? `, strain ${d.strain.toFixed(1)}` : ''}</li>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e0e0e0;">
  <h1 style="color:#60a5fa;margin-bottom:4px;">&#128202; Monthly Performance Report</h1>
  <p style="color:#94a3b8;margin-top:0;">${esc(label)} &middot; ${cur.days} day${cur.days === 1 ? '' : 's'} of data</p>

  <h2 style="color:#a78bfa;">Averages</h2>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#141414;border-radius:8px;">
    <tr><th style="padding:8px;text-align:left;color:#888;font-weight:normal;font-size:12px;">Metric</th><th style="padding:8px;text-align:right;color:#888;font-weight:normal;font-size:12px;">${esc(label)}</th><th style="padding:8px;text-align:right;color:#888;font-weight:normal;font-size:12px;">vs prev. month</th></tr>
    ${row('Readiness', fmt(cur.readiness), delta(cur.readiness, prev.readiness))}
    ${row('Recovery', fmt(cur.recovery), delta(cur.recovery, prev.recovery))}
    ${row('Sleep', dur(cur.sleep), delta(cur.sleep, prev.sleep, 0, ' min'))}
    ${row('Sleep debt', dur(cur.debt), delta(cur.debt, prev.debt, 0, ' min', true))}
    ${row('Strain (0–21)', fmt(cur.strain, 1), delta(cur.strain, prev.strain, 1))}
    ${row('HRV (night)', fmt(cur.hrv, 0, ' ms'), delta(cur.hrv, prev.hrv, 0, ' ms'))}
    ${row('Resting HR', fmt(cur.rhr, 0, ' bpm'), delta(cur.rhr, prev.rhr, 0, ' bpm', true))}
    ${row('Steps', cur.steps == null ? '—' : Math.round(cur.steps).toLocaleString('en-US'), delta(cur.steps, prev.steps))}
    ${args.completion != null ? row('Task completion', `${Math.round(args.completion)}%`, '') : ''}
  </table>

  <h2 style="color:#a78bfa;">Fitness</h2>
  <ul>
    <li>Fitness (CTL): ${fmt(args.ctl.from, 1)} &rarr; ${fmt(args.ctl.to, 1)} (${signed(args.ctl.delta)})</li>
    <li>VO&#8322; max: ${fmt(args.vo2.from, 1)} &rarr; ${fmt(args.vo2.to, 1)} (${signed(args.vo2.delta)})</li>
    <li>Illness-warning days: ${args.illnessDays.length}${args.illnessDays.length ? ` (${args.illnessDays.map(esc).join(', ')})` : ''}</li>
  </ul>

  ${args.best.length ? `<h2 style="color:#a78bfa;">Best days</h2><ul>${args.best.map(dayRow).join('')}</ul>` : ''}
  ${args.worst.length ? `<h2 style="color:#a78bfa;">Toughest days</h2><ul>${args.worst.map(dayRow).join('')}</ul>` : ''}

  <h2 style="color:#a78bfa;">What moved the needle</h2>
  ${args.correlations.length
    ? `<ul>${args.correlations.map((c) => `<li>${esc(c.sentence)} <span style="color:#888;font-size:12px;">(r=${c.r ?? '—'})</span></li>`).join('')}</ul>`
    : '<p style="color:#94a3b8;">Not enough data yet for reliable behaviour &rarr; outcome patterns.</p>'}

  <p style="margin-top:32px;text-align:center;color:#666;font-size:12px;">
    Computed from your own data only &bull; <a href="${esc(args.appUrl)}/dashboard" style="color:#60a5fa;">Open Dashboard</a>
  </p>
</body></html>`;
}

async function recipient(userId: string): Promise<string | null> {
  const env = process.env.USER_EMAIL || process.env.REPORT_EMAIL;
  if (env) return env;
  try {
    const { data } = await getSupabaseAdmin().auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = process.env.NEXT_PUBLIC_USER_ID;
  if (!userId) return NextResponse.json({ error: 'User ID not configured' }, { status: 500 });

  const q = request.nextUrl.searchParams;
  const monthParam = q.get('month');
  const month = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : defaultMonth(localToday());
  const { from, to, label } = monthRange(month);
  const prevRange = monthRange(addDays(from, -1).slice(0, 7));

  try {
    // Enough history for the month, the previous month and correlation context
    const all = await getHealthDays(userId, 160);
    const inRange = (d: HealthDay, a: string, b: string) => d.date >= a && d.date <= b;
    const days = all.filter((d) => inRange(d, from, to));
    const prevDays = all.filter((d) => inRange(d, prevRange.from, prevRange.to));
    if (!days.length) {
      return NextResponse.json({ success: true, sent: false, reason: `no health data for ${month}` });
    }

    const corrFrom = addDays(from, -60);
    const corrDays = all.filter((d) => inRange(d, corrFrom, to));
    const context = await buildContext(userId, corrFrom, to);
    const correlations = corrDays.length >= 14 ? correlate(corrDays, context).slice(0, 3) : [];

    const monthCtx = context.filter((c) => c.date >= from && c.date <= to);
    const planned = monthCtx.reduce((a, c) => a + c.tasksPlanned, 0);
    const completion = planned ? (100 * monthCtx.reduce((a, c) => a + c.tasksCompleted, 0)) / planned : null;

    const scored = days.filter((d) => d.readiness != null || d.recovery != null);
    const score = (d: HealthDay) => (d.readiness ?? d.recovery ?? 0);
    const sorted = [...scored].sort((a, b) => score(b) - score(a));
    const n = Math.min(3, Math.floor(sorted.length / 2));

    const html = renderHtml({
      label,
      cur: summarise(days),
      prev: summarise(prevDays),
      ctl: change(days, 'ctl'),
      vo2: change(days, 'vo2max'),
      illnessDays: days.filter((d) => d.illness_flag).map((d) => d.date),
      best: sorted.slice(0, n),
      worst: sorted.slice(-n).reverse(),
      correlations,
      completion,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://your-goal-tracker.vercel.app',
    });

    if (q.get('dry') === '1') {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const to_ = await recipient(userId);
    if (!apiKey || !to_) {
      return NextResponse.json({ success: false, error: 'RESEND_API_KEY or recipient (USER_EMAIL) not configured' }, { status: 500 });
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MTO Second Brain <noreply@resend.dev>',
        to: [to_],
        subject: `Monthly Performance Report - ${label}`,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Cron/MonthlyReport] Resend error', err);
      return NextResponse.json({ success: false, error: `Resend error: ${err}` }, { status: 502 });
    }
    const out = await res.json();
    return NextResponse.json({ success: true, sent: true, month, emailId: out.id, days: days.length });
  } catch (e) {
    console.error('[Cron/MonthlyReport] failed', e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
