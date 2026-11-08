/**
 * Optional health blocks for the morning / night emails (PLAN.md B4, C3).
 * Payloads are built by the Next.js cron routes (src/lib/health-email.ts).
 * Every field is optional so older callers (e.g. the app's wake-up button,
 * which only sends { mood }) keep working: missing payload → empty string.
 */

// deno-lint-ignore no-explicit-any
type Any = any;

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const dur = (min: unknown): string => {
  if (!isNum(min)) return '—';
  const m = Math.round(Math.abs(min));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

const scoreColor = (v: unknown): string =>
  !isNum(v) ? '#94a3b8' : v >= 67 ? '#22c55e' : v >= 34 ? '#eab308' : '#ef4444';

const tile = (value: string, label: string, color = '#60a5fa') => `
      <td style="padding:6px;width:33%;">
        <div style="background:#1e1e1e;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:24px;font-weight:bold;color:${color};">${value}</div>
          <div style="font-size:11px;color:#888;margin-top:4px;">${label}</div>
        </div>
      </td>`;

const win = (w: unknown): string | null =>
  Array.isArray(w) && w.length === 2 ? `${esc(w[0])}&ndash;${esc(w[1])}` : null;

/** Compact "Readiness" block for the morning email. */
export function renderReadinessBlock(h: Any): string {
  if (!h || typeof h !== 'object') return '';
  const sleep = h.sleep ?? {};
  const rows: string[] = [];
  if (h.illness_flag) {
    rows.push(`<p style="margin:8px 0;color:#f87171;"><strong>Possible illness signs.</strong> Keep today light.</p>`);
  }
  if (h.session_advice) rows.push(`<p style="margin:8px 0;"><strong>Training:</strong> ${esc(h.session_advice)}</p>`);
  const peak = win(h.peak_window);
  const peak2 = win(h.second_peak_window);
  if (peak) {
    rows.push(`<p style="margin:8px 0;"><strong>Deep-work window:</strong> ${peak}${peak2 ? ` &middot; second peak ${peak2}` : ''}</p>`);
  }
  if (isNum(sleep.minutes)) {
    const parts = [`${dur(sleep.minutes)} slept`];
    if (isNum(sleep.score)) parts.push(`score ${Math.round(sleep.score)}`);
    if (isNum(sleep.debt_minutes) && sleep.debt_minutes > 0) parts.push(`${dur(sleep.debt_minutes)} sleep debt`);
    rows.push(`<p style="margin:8px 0;"><strong>Sleep:</strong> ${parts.join(' &middot; ')}</p>`);
  }
  if (h.top_insight?.title) {
    rows.push(`<p style="margin:12px 0 0;padding-top:10px;border-top:1px solid #333;"><strong>${esc(h.top_insight.title)}</strong><br><span style="color:#cbd5e1;">${esc(h.top_insight.body)}</span></p>`);
  }
  return `
  <h2>&#128154; Readiness</h2>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
    ${tile(isNum(h.readiness) ? String(Math.round(h.readiness)) : '—', 'Readiness', scoreColor(h.readiness))}
    ${tile(isNum(h.recovery) ? String(Math.round(h.recovery)) : '—', 'Recovery', scoreColor(h.recovery))}
    ${tile(isNum(h.capacity_hours) ? `${Math.round(h.capacity_hours * 10) / 10}h` : '—', 'Focus capacity')}
  </tr></table>
  <div style="background:#1e1e1e;padding:12px 16px;border-radius:8px;margin-top:8px;">${rows.join('')}</div>`;
}

/** Bedtime target + sleep debt + today's strain for the night email. */
export function renderNightHealthBlock(h: Any): string {
  if (!h || typeof h !== 'object') return '';
  const debt = isNum(h.sleep_debt_minutes) ? h.sleep_debt_minutes : null;
  const notes: string[] = [];
  if (h.bedtime) {
    notes.push(`Aim to be asleep by <strong>${esc(h.bedtime)}</strong>${h.wake ? ` to wake around ${esc(h.wake)}` : ''}${isNum(h.sleep_need_minutes) ? ` (tonight's need: ${dur(h.sleep_need_minutes)})` : ''}.`);
  }
  if (debt != null && debt > 60) notes.push('You are carrying sleep debt &mdash; an earlier night pays it back fastest.');
  if (isNum(h.high_stress_minutes) && h.high_stress_minutes >= 120) {
    notes.push(`${dur(h.high_stress_minutes)} of high stress today &mdash; wind down before bed.`);
  }
  return `
  <h2>&#128716; Tonight</h2>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
    ${tile(h.bedtime ? esc(h.bedtime) : '—', 'Bedtime target', '#a78bfa')}
    ${tile(debt != null ? (debt > 0 ? dur(debt) : 'None') : '—', 'Sleep debt', debt != null && debt > 60 ? '#eab308' : '#22c55e')}
    ${tile(isNum(h.strain) ? (Math.round(h.strain * 10) / 10).toFixed(1) : '—', "Today's strain (0–21)")}
  </tr></table>
  ${notes.length ? `<div style="background:#1e1e1e;padding:12px 16px;border-radius:8px;margin-top:8px;">${notes.map((n) => `<p style="margin:6px 0;">${n}</p>`).join('')}</div>` : ''}`;
}
