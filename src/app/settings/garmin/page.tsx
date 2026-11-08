'use client';

import { useCallback, useEffect, useState } from 'react';

const PIN_KEY = 'garmin_settings_pin';

type Latest = { calendar_date: string | null; start_time: string | null; data: Record<string, unknown> };
interface Status {
  configured: boolean;
  connected: boolean;
  connection: {
    garminUserId: string | null;
    connectedAt: string;
    lastDataAt: string | null;
    permissions: string[] | null;
  } | null;
  counts: Record<string, number>;
  latest: Record<string, Latest>;
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 20,
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function fmtDuration(seconds: number | null) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="text-xs" style={{ color: 'var(--text-2)' }}>{label}</div>
      <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'var(--text-2)' }}>{sub}</div>}
    </div>
  );
}

function buildMetrics(latest: Record<string, Latest>) {
  const d = latest.dailies?.data ?? {};
  const s = latest.sleeps?.data ?? {};
  const h = latest.hrv?.data ?? {};
  const st = latest.stressDetails?.data ?? {};
  const ox = latest.pulseox?.data ?? {};
  const um = latest.userMetrics?.data ?? {};
  const hrvSummary = (h.hrvSummary ?? h) as Record<string, unknown>;
  const sleepScore = ((s.overallSleepScore ?? {}) as Record<string, unknown>).value;

  const bbValues = st.timeOffsetBodyBatteryValues as Record<string, number> | undefined;
  const bbLatest = bbValues ? Object.entries(bbValues).sort((a, b) => Number(a[0]) - Number(b[0])).at(-1)?.[1] : undefined;

  const spo2Values = ox.timeOffsetSpo2Values as Record<string, number> | undefined;
  const spo2 = spo2Values ? Object.values(spo2Values) : [];
  const spo2Avg = spo2.length ? Math.round(spo2.reduce((a, b) => a + b, 0) / spo2.length) : null;

  const v = (x: unknown, suffix = '') => (num(x) != null ? `${Math.round(num(x)!).toLocaleString()}${suffix}` : '—');

  return [
    { label: 'Steps', value: v(d.steps), sub: num(d.stepsGoal) ? `goal ${v(d.stepsGoal)}` : latest.dailies?.calendar_date ?? undefined },
    { label: 'Resting HR', value: v(d.restingHeartRateInBeatsPerMinute, ' bpm'), sub: num(d.maxHeartRateInBeatsPerMinute) ? `max ${v(d.maxHeartRateInBeatsPerMinute)}` : undefined },
    { label: 'Avg stress', value: v(d.averageStressLevel), sub: num(d.maxStressLevel) ? `max ${v(d.maxStressLevel)}` : undefined },
    { label: 'Body Battery', value: v(bbLatest ?? d.bodyBatteryMostRecentValue), sub: num(d.bodyBatteryChargedValue) ? `+${v(d.bodyBatteryChargedValue)} / -${v(d.bodyBatteryDrainedValue)}` : undefined },
    { label: 'Sleep', value: fmtDuration(num(s.durationInSeconds)), sub: num(sleepScore) ? `score ${v(sleepScore)}` : latest.sleeps?.calendar_date ?? undefined },
    { label: 'HRV (night avg)', value: v(hrvSummary.lastNightAvg, ' ms'), sub: num(hrvSummary.lastNight5MinHigh) ? `5-min high ${v(hrvSummary.lastNight5MinHigh)}` : undefined },
    { label: 'SpO₂', value: spo2Avg != null ? `${spo2Avg}%` : '—' },
    { label: 'Active kcal', value: v(d.activeKilocalories), sub: num(d.moderateIntensityDurationInSeconds) != null ? `${Math.round((num(d.moderateIntensityDurationInSeconds)! + (num(d.vigorousIntensityDurationInSeconds) ?? 0) * 2) / 60)} intensity min` : undefined },
    { label: 'VO₂ max', value: v(um.vo2Max), sub: num(um.fitnessAge) ? `fitness age ${v(um.fitnessAge)}` : undefined },
  ];
}

export default function GarminSettingsPage() {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: string) => {
    const res = await fetch('/api/garmin/status', { headers: { 'x-site-pin': p } });
    if (res.status === 401) {
      setStatus(null);
      setMessage('Wrong PIN');
      try { sessionStorage.removeItem(PIN_KEY); } catch {}
      return;
    }
    const data = (await res.json()) as Status;
    setStatus(data);
    try { sessionStorage.setItem(PIN_KEY, p); } catch {}
  }, []);

  useEffect(() => {
    // Read URL params / saved PIN after mount (window isn't available during prerender)
    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('connected')) setMessage('Garmin connected. History for the last 30 days is on its way.');
      if (params.get('error')) setMessage(`Garmin connection failed: ${params.get('error')}`);
      let saved: string | null = null;
      try { saved = sessionStorage.getItem(PIN_KEY); } catch {}
      if (saved) {
        setPin(saved);
        void load(saved);
      }
    });
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Something went wrong'); }
    setBusy(false);
  };

  const connect = () => act(async () => {
    const res = await fetch('/api/garmin/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    window.location.href = data.url;
  });

  const backfill = () => act(async () => {
    const res = await fetch('/api/garmin/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, days: 90 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setMessage('Asked Garmin for the last 90 days. It can take a few minutes to arrive.');
  });

  const disconnectGarmin = () => act(async () => {
    if (!confirm('Disconnect your Garmin account? Stored data is kept.')) return;
    await fetch('/api/garmin/status', { method: 'DELETE', headers: { 'x-site-pin': pin } });
    await load(pin);
    setMessage('Garmin disconnected.');
  });

  const buttonStyle = (primary = false): React.CSSProperties => ({
    background: primary ? 'var(--gold)' : 'var(--bg)',
    color: primary ? 'var(--bg)' : 'var(--text)',
    border: `1px solid ${primary ? 'var(--gold)' : 'var(--border)'}`,
    borderRadius: 12,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    opacity: busy ? 0.6 : 1,
  });

  return (
    <div className="space-y-4">
      <div style={card}>
        <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>Garmin</h2>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Heart rate, HRV, sleep, stress, Body Battery, SpO₂, steps and workouts from your watch, sent here each time it syncs with Garmin Connect.
        </p>
      </div>

      {message && (
        <div style={{ ...card, padding: 14 }} className="text-sm">
          <span style={{ color: 'var(--text)' }}>{message}</span>
        </div>
      )}

      {!status ? (
        <div style={card}>
          <label className="text-sm block mb-2" style={{ color: 'var(--text-2)' }}>Enter your site PIN to manage Garmin</label>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pin && act(() => load(pin))}
              className="flex-1 rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <button disabled={!pin || busy} onClick={() => act(() => load(pin))} style={buttonStyle(true)}>
              Unlock
            </button>
          </div>
        </div>
      ) : !status.configured ? (
        <div style={card} className="text-sm">
          <p style={{ color: 'var(--text)' }}>Garmin API keys aren&apos;t set up yet.</p>
          <p className="mt-2" style={{ color: 'var(--text-2)' }}>
            Add <code>GARMIN_CLIENT_ID</code> and <code>GARMIN_CLIENT_SECRET</code> from the Garmin Connect Developer Program to Vercel, then redeploy.
          </p>
        </div>
      ) : !status.connected ? (
        <div style={card}>
          <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
            You&apos;ll sign in to Garmin and choose which data to share.
          </p>
          <button disabled={busy} onClick={connect} style={buttonStyle(true)}>Connect Garmin</button>
        </div>
      ) : (
        <>
          <div style={card}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <div style={{ color: 'var(--text)' }}>● Connected</div>
                <div style={{ color: 'var(--text-2)' }}>
                  Last data: {status.connection?.lastDataAt ? new Date(status.connection.lastDataAt).toLocaleString() : 'waiting for first sync'}
                </div>
              </div>
              <div className="flex gap-2">
                <button disabled={busy} onClick={backfill} style={buttonStyle()}>Load 90 days</button>
                <button disabled={busy} onClick={disconnectGarmin} style={buttonStyle()}>Disconnect</button>
              </div>
            </div>
          </div>

          <div style={card}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Latest</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {buildMetrics(status.latest).map((m) => <Metric key={m.label} {...m} />)}
            </div>
          </div>

          <div style={card}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Stored records</h3>
            <div className="text-xs grid grid-cols-2 gap-1" style={{ color: 'var(--text-2)' }}>
              {Object.entries(status.counts).map(([k, n]) => (
                <div key={k}>{k}: {n}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
