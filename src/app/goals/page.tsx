'use client';

import { useState, useRef } from 'react';
import { Space_Mono } from 'next/font/google';
import { LEVEL_LABELS, LEVEL_COLORS, type GoalLevel } from '@/lib/types';
import { useGoals, useTasks, useDeleteGoal, useAddTask, useClearUserData } from '@/lib/hooks/useSupabase';
import Link from 'next/link';
import type { Goal, Task } from '@/lib/types';

const mono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], display: 'swap' });

const LEVELS: GoalLevel[] = ['yearly', 'quarterly', 'monthly', 'weekly'];
const LEVEL_ICONS: Record<GoalLevel, string> = {
  yearly: '🎯',
  quarterly: '📊',
  monthly: '📅',
  weekly: '📆',
  uncategorized: '❓',
};

// ─── Inline task add per goal ────────────────────────────────────────────────

function InlineTaskAdd({ goalId }: { goalId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addTask = useAddTask();

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    addTask.mutate(
      { title: title.trim(), estimatedMinutes: 30, goalId },
      {
        onSuccess: () => {
          setTitle('');
          setBusy(false);
          inputRef.current?.focus();
        },
        onError: (err) => {
          console.error('[InlineTaskAdd] Failed:', err);
          setBusy(false);
        },
      },
    );
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setTitle('');
    }
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-400 hover:bg-white/[0.03] transition-all text-xs group"
      >
        <span className="text-base leading-none group-hover:text-violet-400 transition-colors">+</span>
        <span>Add task</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-1">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Task name…"
        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 transition-all"
      />
      <button
        type="submit"
        disabled={!title.trim() || busy}
        className={`${mono.className} px-3 py-2 text-xs font-bold rounded-xl transition-all disabled:opacity-30 bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25`}
      >
        {busy ? '…' : 'ADD'}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setTitle(''); }}
        className="text-slate-600 hover:text-slate-400 px-1 text-lg leading-none"
      >
        ×
      </button>
    </form>
  );
}

// ─── Goal card ───────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  tasks,
  onDelete,
}: {
  goal: Goal;
  tasks: Task[];
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const goalTasks = tasks.filter((t) => t.goalId === goal.id && !t.isArchived);
  const completed = goalTasks.filter((t) => t.isCompleted).length;
  const total = goalTasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isOverdue = goal.deadline && new Date(goal.deadline) < new Date();

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-200 bg-white/[0.015] ${
        open ? 'border-white/[0.1]' : 'border-white/[0.06] hover:border-white/[0.09]'
      }`}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {/* Progress ring */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={progress === 100 ? '#22c55e' : '#8b5cf6'}
              strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${progress * 0.942} 94.2`}
              className="transition-all duration-500"
            />
          </svg>
          <span className={`${mono.className} absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white`}>
            {progress}%
          </span>
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold text-white leading-snug`}>{goal.title}</span>
            {goal.priority === 1 && (
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider border border-red-500/30 px-1.5 py-0.5 rounded">
                Critical
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`${mono.className} text-[10px] text-slate-600`}>
              {completed}/{total} tasks
            </span>
            {goal.deadline && (
              <span
                className={`${mono.className} text-[10px] ${isOverdue ? 'text-red-400' : 'text-slate-600'}`}
              >
                · {new Date(goal.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {isOverdue && ' overdue'}
              </span>
            )}
          </div>
        </div>

        {/* Delete + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this goal?')) onDelete(goal.id);
            }}
            className="text-slate-700 hover:text-red-400 transition-colors p-1"
            aria-label="Delete goal"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <span className={`text-slate-600 text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-white/[0.05] px-4 py-3 space-y-1">
          {goal.description && (
            <p className="text-xs text-slate-500 mb-3">{goal.description}</p>
          )}

          {/* Task list */}
          {goalTasks.length === 0 ? (
            <p className="text-xs text-slate-700 italic px-3 py-2">No tasks yet</p>
          ) : (
            goalTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${
                  task.isCompleted ? 'opacity-40' : ''
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                    task.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                  }`}
                >
                  {task.isCompleted && (
                    <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                      <path d="M1 3L2.3 4.3L5 1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <span
                  className={`flex-1 text-sm ${
                    task.isCompleted ? 'line-through text-slate-600' : 'text-slate-300'
                  }`}
                >
                  {task.title}
                </span>
                <span className={`${mono.className} text-[10px] text-slate-700 flex-shrink-0`}>
                  {task.estimatedMinutes}m
                </span>
              </div>
            ))
          )}

          {/* Inline add */}
          <div className="pt-1">
            <InlineTaskAdd goalId={goal.id} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { data: goals = [] } = useGoals();
  const { data: tasks = [] } = useTasks();
  const deleteGoalMutation = useDeleteGoal();
  const clearUserDataMutation = useClearUserData();

  const handleClearAll = () => {
    if (confirm('Delete ALL data? This cannot be undone.')) clearUserDataMutation.mutate();
  };

  const activeGoals = goals.filter((g) => !g.isArchived);

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Goals</h1>
          <p className={`${mono.className} text-xs text-slate-600 mt-0.5`}>
            {activeGoals.length} active
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/create"
            className="px-3 py-1.5 text-xs bg-violet-500/15 border border-violet-500/30 text-violet-400 rounded-xl hover:bg-violet-500/25 transition-all"
          >
            + Goal
          </Link>
          {goals.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {activeGoals.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-lg font-bold text-white mb-2">No goals yet</h2>
          <p className="text-sm text-slate-500 mb-6">Goals give your tasks meaning.</p>
          <Link
            href="/create"
            className="inline-block px-5 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold rounded-xl text-sm"
          >
            Create First Goal
          </Link>
        </div>
      )}

      {/* Goal groups by level */}
      <div className="space-y-6">
        {LEVELS.map((level) => {
          const levelGoals = activeGoals.filter((g) => g.level === level);
          if (!levelGoals.length) return null;

          return (
            <div key={level}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{LEVEL_ICONS[level]}</span>
                <span
                  className={`${mono.className} text-[10px] font-bold uppercase tracking-[0.2em] ${LEVEL_COLORS[level].text}`}
                >
                  {LEVEL_LABELS[level]}s
                </span>
                <span className={`${mono.className} text-[10px] text-slate-700`}>
                  ({levelGoals.length})
                </span>
              </div>

              <div className="space-y-2">
                {levelGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    tasks={tasks}
                    onDelete={(id) => deleteGoalMutation.mutate(id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
