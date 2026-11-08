'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { SleepButton } from '@/components/sleep/SleepButton';
import { ReadinessLine } from '@/components/health/ReadinessLine';
import { useBodyToday } from '@/lib/hooks/useBody';
import { formatDuration } from '@/lib/date-utils';
import { calculateSleepMinutesSoFar, getLocalDateString } from '@/lib/date-utils';
import Link from 'next/link';
import {
  useGoals,
  useTasks,
  useTimeSlots,
  useCompleteTask,
  useUncompleteTask,
  useAddTask,
  useProductivity,
  useAddTimeSlot,
  useSleepLogs,
} from '@/lib/hooks/useSupabase';
import type { Task, Goal, TimeSlot } from '@/lib/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function getNowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function slotMinutes(slot: TimeSlot) {
  const [sh, sm] = slot.startTime.split(':').map(Number);
  const [eh, em] = slot.endTime.split(':').map(Number);
  return { start: sh * 60 + sm, end: eh * 60 + em };
}

function isCurrentSlot(slot: TimeSlot) {
  const now = getNowMinutes();
  const { start, end } = slotMinutes(slot);
  return now >= start && now < end;
}

function getBestTask(
  goals: Goal[],
  tasks: Task[],
  currentSlot: TimeSlot | null,
  focusGoalIds: string[],
): { task: Task; goal: Goal | null } | null {
  const active = tasks.filter((t) => !t.isCompleted && !t.isArchived);
  if (!active.length) return null;

  const goalPriority = (t: Task) => {
    const g = goals.find((g) => g.id === t.goalId);
    if (!g) return 99;
    const focusBonus = focusGoalIds.includes(g.id) ? -10 : 0;
    return (g.priority ?? 2) + focusBonus;
  };

  let pool = active;
  if (currentSlot) {
    const ids = new Set(currentSlot.goalIds ?? []);
    const slotTasks = active.filter((t) => t.goalId && ids.has(t.goalId));
    if (slotTasks.length) pool = slotTasks;
  }

  pool.sort((a, b) => goalPriority(a) - goalPriority(b));
  const task = pool[0];
  return { task, goal: goals.find((g) => g.id === task.goalId) ?? null };
}

// ─── useTime ─────────────────────────────────────────────────────────────────

function useTime() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ─── QuickAdd ────────────────────────────────────────────────────────────────

function QuickAdd({ goals }: { goals: Goal[] }) {
  const [title, setTitle] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addTask = useAddTask();

  const activeGoals = goals.filter((g) => !g.isArchived && g.status !== 'completed');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    addTask.mutate(
      { title: title.trim(), estimatedMinutes: 30, goalId: selectedGoalId ?? undefined },
      {
        onSuccess: () => {
          setTitle('');
          setSelectedGoalId(null);
          setExpanded(false);
          setBusy(false);
          inputRef.current?.focus();
        },
        onError: (err) => {
          console.error('[QuickAdd] Failed:', err);
          setBusy(false);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div
        className="flex items-center gap-3 px-4 rounded-2xl transition-all duration-200"
        style={{
          background:  expanded ? 'var(--surface)'  : 'var(--surface)',
          border:      `1px solid ${expanded ? 'var(--gold)' : 'var(--border)'}`,
          boxShadow:   expanded ? '0 0 0 1px var(--gold-dim)' : 'none',
          minHeight:   52,
        }}
      >
        <span style={{ color: expanded ? 'var(--gold)' : 'var(--text-3)', fontSize: 20, lineHeight: 1 }}>
          +
        </span>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setExpanded(true)}
          onBlur={() => { if (!title.trim()) setExpanded(false); }}
          onKeyDown={(e) => e.key === 'Escape' && (setExpanded(false), setTitle(''), inputRef.current?.blur())}
          placeholder="Quick task…"
          autoComplete="off"
          className="flex-1 bg-transparent focus:outline-none text-sm py-3"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-family-body)' }}
        />
        {title.trim() && (
          <button
            type="submit"
            disabled={busy}
            className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium tracking-widest
                       transition-all active:scale-95 disabled:opacity-40"
            style={{
              background:  'var(--gold-dim)',
              border:      '1px solid var(--gold)',
              color:       'var(--gold)',
              fontFamily:  'var(--font-family-mono)',
            }}
          >
            {busy ? '…' : 'ADD'}
          </button>
        )}
      </div>

      {expanded && activeGoals.length > 0 && (
        <div className="mt-2 px-1 flex gap-1.5 flex-wrap">
          <GoalChip label="no goal" active={selectedGoalId === null} onClick={() => setSelectedGoalId(null)} />
          {activeGoals.slice(0, 6).map((g) => (
            <GoalChip
              key={g.id}
              label={g.title}
              active={selectedGoalId === g.id}
              onClick={() => setSelectedGoalId(g.id)}
            />
          ))}
        </div>
      )}
    </form>
  );
}

function GoalChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-lg text-xs transition-all truncate max-w-[150px]"
      style={{
        fontFamily:  'var(--font-family-body)',
        background:  active ? 'var(--violet-dim)' : 'transparent',
        border:      `1px solid ${active ? 'var(--violet)' : 'transparent'}`,
        color:       active ? 'var(--violet)' : 'var(--text-2)',
      }}
    >
      {label}
    </button>
  );
}

// ─── FocusCard ───────────────────────────────────────────────────────────────

function FocusCard({
  item,
  onComplete,
}: {
  item: { task: Task; goal: Goal | null };
  onComplete: (taskId: string) => void;
}) {
  const [done, setDone] = useState(false);

  const handleDone = () => {
    if (done) return;
    setDone(true);
    setTimeout(() => onComplete(item.task.id), 320);
  };

  return (
    <div
      className="mb-4 rounded-2xl overflow-hidden transition-all duration-300 animate-slide-up"
      style={{
        opacity:   done ? 0 : 1,
        transform: done ? 'scale(0.96)' : 'scale(1)',
        background: 'var(--surface)',
        border:    '1px solid var(--border)',
        boxShadow: '0 0 48px var(--gold-glow)',
      }}
    >
      {/* gold top bar */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, var(--gold), transparent 70%)' }} />

      <div className="p-5">
        {/* label */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--gold)' }}
          />
          <span
            className="text-[10px] tracking-[0.3em] uppercase"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-family-mono)' }}
          >
            Focus Now
          </span>
        </div>

        {/* task title */}
        <p
          className="text-[19px] font-medium leading-snug mb-3"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-family-body)' }}
        >
          {item.task.title}
        </p>

        {/* meta */}
        <div className="flex items-center gap-3 mb-5">
          {item.goal && (
            <span
              className="text-xs truncate max-w-[180px]"
              style={{ color: 'var(--violet)', fontFamily: 'var(--font-family-body)' }}
            >
              {item.goal.title}
            </span>
          )}
          <span
            className="text-xs ml-auto flex-shrink-0"
            style={{ color: 'var(--text-3)', fontFamily: 'var(--font-family-mono)' }}
          >
            {formatDuration(item.task.estimatedMinutes)}
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={handleDone}
          disabled={done}
          className="w-full py-3 rounded-xl text-sm font-medium tracking-wide
                     transition-all duration-200 active:scale-[0.98]"
          style={{
            background:  done ? 'var(--jade-dim)'  : 'var(--gold-dim)',
            border:      `1px solid ${done ? 'var(--jade)' : 'var(--gold)'}`,
            color:       done ? 'var(--jade)'      : 'var(--gold)',
            fontFamily:  'var(--font-family-body)',
          }}
        >
          {done ? '✓  Completed' : 'Mark Done'}
        </button>
      </div>
    </div>
  );
}

// ─── DayBar ──────────────────────────────────────────────────────────────────

function DayBar({
  productiveMinutes,
  sleepMinutes,
  wastedMinutes,
  remainingMinutes,
  hasSleepLog,
}: {
  productiveMinutes: number;
  sleepMinutes: number;
  wastedMinutes: number;
  remainingMinutes: number;
  hasSleepLog: boolean;
}) {
  const total = 24 * 60;
  const pct = (m: number) => Math.max(0, (m / total) * 100);

  return (
    <div
      className="mb-4 p-4 rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* stat row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <DayStat label="Work"      value={formatDuration(productiveMinutes)} color="var(--jade)" />
        <DayStat label="Sleep"     value={formatDuration(sleepMinutes)}      color="var(--sky)"  />
        <DayStat label="Free"      value={formatDuration(wastedMinutes)}     color="var(--text-2)" />
      </div>

      {/* segmented bar */}
      <div
        className="w-full flex overflow-hidden"
        style={{ height: 6, borderRadius: 3, background: 'var(--elevated)', gap: 2 }}
      >
        <div style={{ width: `${pct(sleepMinutes)}%`,      background: 'var(--sky)',      borderRadius: 3, transition: 'width 700ms ease' }} />
        <div style={{ width: `${pct(productiveMinutes)}%`, background: 'var(--jade)',     borderRadius: 3, transition: 'width 700ms ease' }} />
        <div style={{ width: `${pct(wastedMinutes)}%`,     background: 'var(--border-hi)', borderRadius: 3, transition: 'width 700ms ease' }} />
      </div>

      {!hasSleepLog && (
        <p className="text-[10px] mt-2" style={{ color: 'var(--text-3)', fontFamily: 'var(--font-family-body)' }}>
          Sleep not logged — free time includes sleep
        </p>
      )}
    </div>
  );
}

function DayStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div
        className="text-base font-bold"
        style={{ color, fontFamily: 'var(--font-family-mono)' }}
      >
        {value}
      </div>
      <div
        className="text-[10px] uppercase tracking-wider mt-0.5"
        style={{ color: 'var(--text-3)', fontFamily: 'var(--font-family-body)' }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── SlotSection ─────────────────────────────────────────────────────────────

function SlotSection({
  slot,
  goals,
  tasks,
  focusGoalIds,
  onComplete,
  onUncomplete,
  defaultOpen,
}: {
  slot: TimeSlot;
  goals: Goal[];
  tasks: Task[];
  focusGoalIds: string[];
  onComplete: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const current = isCurrentSlot(slot);

  const slotGoals = goals
    .filter((g) => !g.isArchived && ((slot.goalIds ?? []).includes(g.id) || g.timeSlotId === slot.id))
    .sort((a, b) => {
      const fa = focusGoalIds.includes(a.id) ? 0 : 1;
      const fb = focusGoalIds.includes(b.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (a.priority ?? 2) - (b.priority ?? 2);
    });

  const slotTasks = tasks.filter(
    (t) => !t.isArchived && slotGoals.some((g) => g.id === t.goalId),
  );
  const done  = slotTasks.filter((t) => t.isCompleted).length;
  const total = slotTasks.length;
  const allDone = total > 0 && done === total;

  if (!slotGoals.length) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--surface)',
        border:     `1px solid ${current ? 'var(--gold)' : 'var(--border)'}`,
        boxShadow:  current ? '0 0 20px var(--gold-dim)' : 'none',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ minHeight: 52 }}
      >
        <div className="flex items-center gap-2.5">
          {current && (
            <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
              style={{ background: 'var(--gold)' }} />
          )}
          <span className="text-sm font-medium" style={{ color: 'var(--text)', fontFamily: 'var(--font-family-body)' }}>
            {slot.name}
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--text-3)', fontFamily: 'var(--font-family-mono)' }}
          >
            {slot.startTime}–{slot.endTime}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span
              className="text-xs"
              style={{
                color:      allDone ? 'var(--jade)' : 'var(--text-2)',
                fontFamily: 'var(--font-family-mono)',
              }}
            >
              {done}/{total}
            </span>
          )}
          <span
            className="text-xs transition-transform duration-200"
            style={{
              color:     'var(--text-3)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div
          className="px-4 pb-4 pt-3 space-y-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {slotGoals.map((goal) => {
            const goalTasks = tasks.filter((t) => t.goalId === goal.id && !t.isArchived);
            const isFocus   = focusGoalIds.includes(goal.id);
            return (
              <div key={goal.id}>
                <div
                  className="flex items-center gap-2 mb-1.5 pl-2"
                  style={{ borderLeft: `2px solid ${isFocus ? 'var(--gold)' : 'var(--violet)'}` }}
                >
                  <span
                    className="text-xs font-medium truncate"
                    style={{
                      color:      isFocus ? 'var(--gold)' : 'var(--text-2)',
                      fontFamily: 'var(--font-family-body)',
                    }}
                  >
                    {goal.title}
                  </span>
                  {goal.deadline && (
                    <span
                      className="text-[10px] ml-auto flex-shrink-0"
                      style={{
                        color:      new Date(goal.deadline) < new Date() ? 'var(--coral)' : 'var(--text-3)',
                        fontFamily: 'var(--font-family-mono)',
                      }}
                    >
                      {new Date(goal.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                {goalTasks.length === 0 ? (
                  <p className="text-xs pl-4 italic" style={{ color: 'var(--text-3)' }}>No tasks yet</p>
                ) : (
                  <div className="space-y-0.5">
                    {goalTasks.map((task) => (
                      <TaskRow key={task.id} task={task} onComplete={onComplete} onUncomplete={onUncomplete} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  onUncomplete,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
}) {
  return (
    <button
      onClick={() => (task.isCompleted ? onUncomplete(task.id) : onComplete(task.id))}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                 transition-all duration-150 active:scale-[0.99] group"
      style={{
        opacity:    task.isCompleted ? 0.4 : 1,
        background: 'transparent',
      }}
    >
      {/* checkbox */}
      <div
        className="flex-shrink-0 w-[18px] h-[18px] rounded-full border flex items-center
                   justify-center transition-all duration-200"
        style={{
          background: task.isCompleted ? 'var(--jade)'    : 'transparent',
          border:     `1.5px solid ${task.isCompleted ? 'var(--jade)' : 'var(--border-hi)'}`,
        }}
      >
        {task.isCompleted && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3.2 5.8L6.5 2.5" stroke="white" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* title */}
      <span
        className="flex-1 text-sm leading-snug"
        style={{
          color:          task.isCompleted ? 'var(--text-3)' : 'var(--text-2)',
          fontFamily:     'var(--font-family-body)',
          textDecoration: task.isCompleted ? 'line-through' : 'none',
        }}
      >
        {task.title}
      </span>

      {/* duration */}
      <span
        className="text-xs flex-shrink-0"
        style={{ color: 'var(--text-3)', fontFamily: 'var(--font-family-mono)' }}
      >
        {formatDuration(task.estimatedMinutes)}
      </span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: timeSlots = [] }  = useTimeSlots();
  const { data: goals = [] }      = useGoals();
  const { data: tasks = [] }      = useTasks();
  const { data: productivity }    = useProductivity();
  const { data: sleepLogs = [] }  = useSleepLogs();
  const { hasWatch }              = useBodyToday();

  const completeTaskMutation   = useCompleteTask();
  const uncompleteTaskMutation = useUncompleteTask();
  const addTimeSlotMutation    = useAddTimeSlot();

  const focusGoalIds = useAppStore((state) => state.focusGoalIds) ?? [];
  const now          = useTime();

  // ── sleep math ──
  const todayStr     = getLocalDateString();
  const todaySleepLog = sleepLogs.find((l) => l.date === todayStr);
  let sleepMinutes    = todaySleepLog?.sleepDurationMinutes ?? 0;
  if (todaySleepLog?.sleepTime && !todaySleepLog.wakeUpTime) {
    sleepMinutes = calculateSleepMinutesSoFar(todaySleepLog.sleepTime);
  }

  const prodStats        = productivity ?? { todayMinutes: 0, todayPercentage: 0, weekMinutes: 0 };
  const productiveMinutes = prodStats.todayMinutes;
  const minutesPassed    = new Date().getHours() * 60 + new Date().getMinutes();
  const wastedMinutes    = Math.max(0, minutesPassed - (sleepMinutes + productiveMinutes));
  const remainingMinutes = Math.max(0, 24 * 60 - minutesPassed);

  // ── slots ──
  const activeSlots   = timeSlots
    .filter((ts) => ts.isActive)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const currentSlot   = activeSlots.find(isCurrentSlot) ?? null;

  // ── best task ──
  const bestTask = getBestTask(goals, tasks, currentSlot, focusGoalIds);

  // ── handlers ──
  const handleComplete = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) completeTaskMutation.mutate(task);
  };

  const handleUncomplete = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) uncompleteTaskMutation.mutate(task);
  };

  const handleInitialize = () => {
    const defaults = [
      { name: 'Morning Routine', type: 'morning'   as const, startTime: '06:00', endTime: '09:00' },
      { name: 'Deep Work',       type: 'work'       as const, startTime: '09:00', endTime: '12:00' },
      { name: 'Afternoon',       type: 'afternoon'  as const, startTime: '14:00', endTime: '17:00' },
      { name: 'Evening',         type: 'evening'    as const, startTime: '17:00', endTime: '21:00' },
    ];
    defaults.forEach((s) => addTimeSlotMutation.mutate(s));
  };

  // ── empty state ──
  if (timeSlots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-5"
        style={{ minHeight: '60vh' }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          🎯
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-family-body)' }}>
            Set up your day
          </h2>
          <p className="text-sm max-w-xs" style={{ color: 'var(--text-2)', fontFamily: 'var(--font-family-body)' }}>
            Time slots organise goals into focused blocks.
          </p>
        </div>
        <button
          onClick={handleInitialize}
          className="px-6 py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{
            background: 'var(--gold-dim)',
            border:     '1px solid var(--gold)',
            color:      'var(--gold)',
            fontFamily: 'var(--font-family-body)',
          }}
        >
          Initialize Time Slots
        </button>
      </div>
    );
  }

  // ── time strings ──
  const timeStr = now
    ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  });

  const currentSlotIdx = activeSlots.findIndex(isCurrentSlot);
  const doneTodayCount = tasks.filter((t) => t.isCompleted && !t.isArchived).length;

  return (
    <div className="pb-4">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-6 pt-1">
        <div>
          <p
            className="text-[10px] tracking-[0.25em] uppercase mb-1"
            style={{ color: 'var(--text-3)', fontFamily: 'var(--font-family-mono)' }}
          >
            Today
          </p>
          <h1
            className="text-xl font-semibold leading-tight"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-family-body)' }}
          >
            {dateStr}
          </h1>
        </div>
        {timeStr && (
          <p
            className="text-3xl leading-none pb-0.5"
            style={{
              color:      'var(--text)',
              fontFamily: 'var(--font-family-display)',
              fontStyle:  'italic',
              fontWeight: 300,
            }}
          >
            {timeStr}
          </p>
        )}
      </div>

      {/* ── Readiness (one number + one sentence) ──────────────── */}
      <ReadinessLine />

      {/* ── Quick Add ──────────────────────────────────────────── */}
      <QuickAdd goals={goals} />

      {/* ── Focus task ─────────────────────────────────────────── */}
      {bestTask && (
        <FocusCard item={bestTask} onComplete={handleComplete} />
      )}

      {/* ── All clear ──────────────────────────────────────────── */}
      {!bestTask && tasks.filter((t) => !t.isArchived && !t.isCompleted).length === 0 && (
        <div
          className="mb-4 p-5 rounded-2xl text-center"
          style={{
            background: 'var(--jade-dim)',
            border:     '1px solid var(--jade)',
          }}
        >
          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--jade)' }}>All clear</p>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>No pending tasks — add something above.</p>
        </div>
      )}

      {/* ── Day bar ────────────────────────────────────────────── */}
      <DayBar
        productiveMinutes={productiveMinutes}
        sleepMinutes={sleepMinutes}
        wastedMinutes={wastedMinutes}
        remainingMinutes={remainingMinutes}
        hasSleepLog={!!todaySleepLog}
      />

      {/* ── Sleep button (only without a watch: Garmin logs sleep) ─ */}
      {!hasWatch && (
        <div className="mb-4">
          <SleepButton />
        </div>
      )}

      {/* ── Time slots ─────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {activeSlots.map((slot, idx) => (
          <SlotSection
            key={slot.id}
            slot={slot}
            goals={goals}
            tasks={tasks}
            focusGoalIds={focusGoalIds}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            defaultOpen={idx === currentSlotIdx || idx === currentSlotIdx + 1}
          />
        ))}
      </div>

      {/* ── Footer stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 pt-3 mt-2">
        <Link href="/goals">
          <div
            className="p-4 rounded-2xl transition-all active:scale-[0.98]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="text-2xl font-bold mb-0.5"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-family-mono)' }}
            >
              {goals.filter((g) => !g.isArchived).length}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-2)', fontFamily: 'var(--font-family-body)' }}>
              Active Goals
            </div>
          </div>
        </Link>
        <Link href="/tasks">
          <div
            className="p-4 rounded-2xl transition-all active:scale-[0.98]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="text-2xl font-bold mb-0.5"
              style={{ color: 'var(--jade)', fontFamily: 'var(--font-family-mono)' }}
            >
              {doneTodayCount}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-2)', fontFamily: 'var(--font-family-body)' }}>
              Done Today
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}