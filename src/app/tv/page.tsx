'use client';

/**
 * /tv — 10-foot ambient dashboard for a living-room TV (Mi TV / Android TV
 * browser). Open once, enter the PIN with the remote, leave it running.
 *
 * - Clock, readiness, next routine task with countdown, today's routine list
 * - Live heart rate / stress / Body Battery from the watch
 * - When a routine task is due: full-screen prompt with Done / Snooze / Skip,
 *   driven by the TV remote's D-pad (arrow keys + OK/Enter)
 * - Burn-in protection (slow drift) and screen wake lock where supported
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/user';
import { getDeviceToken } from '@/lib/deviceAuth';
import { useBodyToday } from '@/lib/hooks/useBody';
import { readinessColor } from '@/components/health/ReadinessLine';

type Status = 'pending' | 'done' | 'snoozed' | 'skipped';
interface TvTask { id: string; title: string; due: string | null; status: Status; snoozedUntil: number | null }
interface TasksResponse { now: string; readiness: number | null; tasks: TvTask[]; dueNow: string[] }

const headers = (): HeadersInit => ({ 'x-device-token': getDeviceToken() ?? '', 'Content-Type': 'application/json' });

function useTvTasks() {
  return useQuery({
    queryKey: ['tv_tasks'],
    queryFn: async (): Promise<TasksResponse> => {
      const res = await fetch('/api/watch/tasks', { headers: headers(), cache: 'no-store' });
      if (!res.ok) throw new Error(`tasks ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}

function useLive() {
  const userId = getCurrentUserId();
  return useQuery({
    queryKey: ['tv_live', userId],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const { data } = await supabase
        .from('watch_samples')
        .select('metric,ts,value')
        .eq('user_id', userId)
        .gte('ts', since)
        .order('ts', { ascending: false })
        .limit(200);
      const latest: Record<string, { ts: string; value: number }> = {};
      for (const r of data ?? []) if (!latest[r.metric]) latest[r.metric] = { ts: r.ts, value: r.value };
      const { data: daily } = await supabase
        .from('watch_daily')
        .select('steps,step_goal')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1);
      return { latest, daily: daily?.[0] ?? null };
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}

const hm = (min: number | null | undefined) =>
  min == null ? '–' : `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

function minutesUntil(due: string, now: Date) {
  const [h, m] = due.split(':').map(Number);
  return h * 60 + m - (now.getHours() * 60 + now.getMinutes());
}

function countdown(mins: number) {
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function TvPage() {
  const qc = useQueryClient();
  const [now, setNow] = useState<Date | null>(null);
  const tasksQ = useTvTasks();
  const live = useLive();
  const { today } = useBodyToday();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Clock tick + screen wake lock
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    let lock: { release?: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { clearTimeout(first); clearInterval(id); lock?.release?.().catch(() => {}); };
  }, []);

  const data = tasksQ.data;
  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const dueTask = tasks.find((t) => data?.dueNow.includes(t.id) && !dismissed.has(t.id)) ?? null;
  const next = tasks.filter((t) => t.status === 'pending' && t.due).sort((a, b) => a.due!.localeCompare(b.due!))
    .find((t) => !now || minutesUntil(t.due!, now) >= -10) ?? null;
  const done = tasks.filter((t) => t.status === 'done').length;

  const act = useCallback(async (id: string, action: 'done' | 'snooze' | 'skip') => {
    setBusy(true);
    try {
      await fetch(`/api/watch/tasks/${id}/action`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(action === 'skip' ? { action, reason: 'skipped on TV' } : action === 'snooze' ? { action, minutes: 15 } : { action }),
      });
      setDismissed((d) => new Set(d).add(id));
      await qc.invalidateQueries({ queryKey: ['tv_tasks'] });
    } finally {
      setBusy(false);
    }
  }, [qc]);

  // D-pad navigation for the due prompt (Left/Right + OK). Focus first button when it opens.
  useEffect(() => {
    if (!dueTask) return;
    const t = setTimeout(() => btnRefs.current[0]?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setFocus((f) => { const n = Math.min(2, f + 1); btnRefs.current[n]?.focus(); return n; }); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setFocus((f) => { const n = Math.max(0, f - 1); btnRefs.current[n]?.focus(); return n; }); }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [dueTask]);

  if (!now) return <div style={{ background: '#000', minHeight: '100vh' }} />;

  // Burn-in protection: drift a few pixels every few minutes
  const drift = (Math.floor(now.getTime() / 180_000) % 5) * 3 - 6;
  const l = live.data?.latest ?? {};
  const fresh = (x?: { ts: string }) => x && Date.now() - Date.parse(x.ts) < 30 * 60_000;
  const stale = tasksQ.isError;

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-family-body)', cursor: 'none' }}
    >
      <div className="h-full w-full grid gap-[3vw] p-[4vw]" style={{ gridTemplateColumns: '1.1fr 1fr', transform: `translate(${drift}px, ${-drift}px)` }}>
        {/* Left: clock, readiness */}
        <div className="flex flex-col justify-between">
          <div>
            <div style={{ fontSize: '11vw', lineHeight: 0.9, fontFamily: 'var(--font-family-display)', fontStyle: 'italic', fontWeight: 300 }}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            <div style={{ fontSize: '1.8vw', color: 'var(--text-2)', marginTop: '1vw' }}>
              {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>

          {today?.readiness != null ? (
            <div className="flex items-center gap-[2vw]">
              <div className="text-center">
                <div style={{ fontSize: '7vw', lineHeight: 1, color: readinessColor(today.readiness), fontFamily: 'var(--font-family-display)', fontStyle: 'italic' }}>
                  {today.readiness}
                </div>
                <div style={{ fontSize: '0.9vw', letterSpacing: '0.3em', color: 'var(--text-3)' }}>READINESS</div>
              </div>
              <div style={{ maxWidth: '28vw' }}>
                <div style={{ fontSize: '1.7vw', fontWeight: 600 }}>{today.insights?.[0]?.title ?? `${today.capacity_hours ?? '–'}h focus capacity`}</div>
                <div style={{ fontSize: '1.3vw', color: 'var(--text-2)', marginTop: '0.4vw' }}>
                  {today.insights?.[0]?.body ?? today.session_advice}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '1.4vw', color: 'var(--text-3)' }}>Readiness appears after your watch syncs a night of sleep.</div>
          )}

          {/* Body strip */}
          <div className="grid grid-cols-5 gap-[1vw]">
            {[
              ['Sleep', hm(today?.sleep_minutes)],
              ['Heart', fresh(l.hr) ? `${Math.round(l.hr.value)}` : '–'],
              ['Stress', fresh(l.stress) ? `${Math.round(l.stress.value)}` : today?.stress_avg != null ? `${Math.round(today.stress_avg)}` : '–'],
              ['Battery', fresh(l.bodyBattery) ? `${Math.round(l.bodyBattery.value)}` : today?.bb_at_wake ?? '–'],
              ['Steps', live.data?.daily?.steps != null ? live.data.daily.steps.toLocaleString() : today?.steps?.toLocaleString() ?? '–'],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-[1vw] p-[1vw]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9vw', letterSpacing: '0.25em', color: 'var(--text-2)', textTransform: 'uppercase' }}>{k}</div>
                <div style={{ fontSize: '1.8vw', fontFamily: 'var(--font-family-mono)', whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: next task + list */}
        <div className="flex flex-col gap-[2vw] min-h-0">
          <div className="rounded-[1.5vw] p-[2vw]" style={{ background: 'var(--surface)', border: '1px solid var(--gold)' }}>
            <div style={{ fontSize: '0.9vw', letterSpacing: '0.3em', color: 'var(--gold)' }}>NEXT UP</div>
            {next ? (
              <>
                <div style={{ fontSize: '3vw', fontWeight: 600, marginTop: '0.6vw', lineHeight: 1.1 }}>{next.title}</div>
                <div style={{ fontSize: '1.6vw', color: 'var(--text-2)', marginTop: '0.6vw', fontFamily: 'var(--font-family-mono)' }}>
                  {next.due} · {countdown(minutesUntil(next.due!, now))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '2vw', marginTop: '0.6vw', color: 'var(--text-2)' }}>
                {tasks.length ? 'Nothing else scheduled today' : 'No routine tasks today'}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 rounded-[1.5vw] p-[1.5vw] overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between" style={{ fontSize: '0.9vw', letterSpacing: '0.3em', color: 'var(--text-2)' }}>
              <span>TODAY&apos;S ROUTINE</span>
              <span>{done}/{tasks.length} DONE</span>
            </div>
            <div className="mt-[1vw] space-y-[0.6vw]">
              {tasks.slice(0, 9).map((t) => (
                <div key={t.id} className="flex items-center gap-[1vw]" style={{ fontSize: '1.5vw', opacity: t.status === 'done' || t.status === 'skipped' ? 0.45 : 1 }}>
                  <span style={{ width: '1.4vw', color: t.status === 'done' ? 'var(--jade)' : t.status === 'snoozed' ? 'var(--gold)' : 'var(--text-3)' }}>
                    {t.status === 'done' ? '✓' : t.status === 'skipped' ? '–' : t.status === 'snoozed' ? 'z' : '○'}
                  </span>
                  <span style={{ width: '5vw', fontFamily: 'var(--font-family-mono)', color: 'var(--text-2)' }}>{t.due ?? ''}</span>
                  <span className="truncate" style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                </div>
              ))}
            </div>
          </div>
          {stale && <div style={{ fontSize: '1vw', color: 'var(--coral)' }}>Can&apos;t reach Goal Tracker — retrying every minute.</div>}
        </div>
      </div>

      {/* Due prompt: two-way with the remote */}
      {dueTask && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="rounded-[2vw] p-[3vw] text-center" style={{ background: 'var(--surface)', border: '2px solid var(--gold)', width: '60vw' }}>
            <div style={{ fontSize: '1vw', letterSpacing: '0.3em', color: 'var(--gold)' }}>ROUTINE · {dueTask.due ?? 'NOW'}</div>
            <div style={{ fontSize: '4vw', fontWeight: 600, margin: '1.5vw 0 2.5vw' }}>{dueTask.title}</div>
            <div className="flex justify-center gap-[2vw]">
              {(['done', 'snooze', 'skip'] as const).map((a, i) => (
                <button
                  key={a}
                  ref={(el) => { btnRefs.current[i] = el; }}
                  disabled={busy}
                  onFocus={() => setFocus(i)}
                  onClick={() => act(dueTask.id, a)}
                  className="rounded-[1vw] outline-none transition-transform"
                  style={{
                    fontSize: '2vw',
                    padding: '1vw 3vw',
                    background: focus === i ? 'var(--gold)' : 'var(--elevated)',
                    color: focus === i ? 'var(--bg)' : 'var(--text)',
                    border: `2px solid ${focus === i ? 'var(--gold)' : 'var(--border)'}`,
                    transform: focus === i ? 'scale(1.08)' : 'none',
                  }}
                >
                  {a === 'done' ? 'Done' : a === 'snooze' ? 'Snooze 15' : 'Skip'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '1vw', color: 'var(--text-3)', marginTop: '1.5vw' }}>◀ ▶ to choose · OK to confirm</div>
          </div>
        </div>
      )}
    </div>
  );
}
