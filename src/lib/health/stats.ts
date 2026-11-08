/** Small numeric helpers used by the scoring code. */

export const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

/**
 * Personal baseline from history values (oldest→newest, today excluded).
 * Requires `min` points; sd gets a floor so a very stable metric doesn't
 * produce huge z-scores from tiny changes.
 */
export function baseline(values: (number | null | undefined)[], min = 5, sdFloorRatio = 0.05): Baseline | null {
  const xs = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (xs.length < min) return null;
  const m = mean(xs)!;
  const s = Math.max(sd(xs) ?? 0, Math.abs(m) * sdFloorRatio, 1e-6);
  return { mean: m, sd: s, n: xs.length };
}

export function z(value: number | null, b: Baseline | null): number | null {
  if (value == null || !b) return null;
  return (value - b.mean) / b.sd;
}

/** Exponentially-weighted moving average with time constant `days`. */
export function ewma(prev: number | null, value: number, days: number): number {
  const k = 1 - Math.exp(-1 / days);
  return prev == null ? value : prev + k * (value - prev);
}

/** Pearson correlation; null if fewer than `min` pairs or no variance. */
export function pearson(pairs: [number, number][], min = 8): number | null {
  if (pairs.length < min) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Linear-regression slope of ys over index (per day). */
export function slope(ys: (number | null)[]): number | null {
  const pts = ys.map((y, i) => [i, y] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 4) return null;
  const mx = mean(pts.map((p) => p[0]))!;
  const my = mean(pts.map((p) => p[1]))!;
  let num_ = 0;
  let den = 0;
  for (const [x, y] of pts) {
    num_ += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den === 0 ? null : num_ / den;
}

/* ─── Time helpers (all local time via a fixed UTC offset in seconds) ─── */

export function localDate(epochSec: number, offsetSec: number): string {
  return new Date((epochSec + offsetSec) * 1000).toISOString().slice(0, 10);
}

/** Minutes after local midnight */
export function localMinutes(epochSec: number, offsetSec: number): number {
  const d = new Date((epochSec + offsetSec) * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function hhmm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** UTC offset (seconds) of an IANA zone at a given instant. */
export function tzOffsetSeconds(timeZone: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 1000);
}
