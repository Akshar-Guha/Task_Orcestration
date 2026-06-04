'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Space_Mono } from 'next/font/google';
import { useAppStore } from '@/lib/store';
import { useGoals, useTimeSlots, useAddGoal, useAddTask } from '@/lib/hooks/useSupabase';
import type { GoalLevel, CreateGoalInput, CreateTaskInput, GoalMetadata } from '@/lib/types';
import { DURATION_OPTIONS, formatDuration } from '@/lib/types';

const mono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], display: 'swap' });

const LEVEL_OPTIONS: { value: GoalLevel; label: string; emoji: string }[] = [
  { value: 'weekly', label: 'Weekly', emoji: 'ðŸ“…' },
  { value: 'monthly', label: 'Monthly', emoji: 'ðŸ“†' },
  { value: 'quarterly', label: 'Quarterly', emoji: 'ðŸ“Š' },
  { value: 'yearly', label: 'Yearly', emoji: 'ðŸŽ¯' },
  { value: 'uncategorized', label: 'Other', emoji: 'ðŸ“Œ' },
];

const PRIORITY_OPTIONS: { value: 1 | 2 | 3; label: string; border: string; active: string }[] = [
  { value: 1, label: 'Critical', border: 'border-red-500/40', active: 'bg-red-500/20 border-red-500/60 text-red-300' },
  { value: 2, label: 'Important', border: 'border-yellow-500/40', active: 'bg-yellow-500/20 border-yellow-500/60 text-yellow-300' },
  { value: 3, label: 'Nice-to-have', border: 'border-green-500/40', active: 'bg-green-500/20 border-green-500/60 text-green-300' },
];

function getGoalMetadata(level: GoalLevel): GoalMetadata {
  const now = new Date();
  switch (level) {
    case 'yearly':
      return { type: 'yearly', year: now.getFullYear() };
    case 'quarterly': {
      const quarter = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
      return { type: 'quarterly', year: now.getFullYear(), quarter };
    }
    case 'monthly':
      return { type: 'monthly', year: now.getFullYear(), month: now.getMonth() + 1 };
    case 'weekly': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      return { type: 'weekly', weekStartDate: monday.toISOString().split('T')[0] };
    }
    default:
      return { type: 'uncategorized' };
  }
}

// â”€â”€â”€ Shared field styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const inputCls =
  'w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-all text-sm';

const labelCls = 'block text-[10px] text-slate-600 uppercase tracking-[0.15em] mb-2';

// â”€â”€â”€ Task Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TaskForm({
  goals,
  focusGoalIds,
  onSubmit,
}: {
  goals: ReturnType<typeof useGoals>['data'];
  focusGoalIds: string[];
  onSubmit: (input: CreateTaskInput) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const activeGoals = (goals ?? [])
    .filter((g) => !g.isArchived)
    .sort((a, b) => {
      const af = focusGoalIds.includes(a.id) ? 0 : 1;
      const bf = focusGoalIds.includes(b.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      const so: Record<string, number> = { in_progress: 0, not_started: 1, completed: 2 };
      return (so[a.status] ?? 1) - (so[b.status] ?? 1);
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const t = title.trim();
    if (!t) { setError('Title required'); return; }
    if (t.length > 200) { setError('Title max 200 chars'); return; }
    if (estimatedMinutes < 5 || estimatedMinutes > 480) {
      setError('Duration: 5â€“480 min'); return;
    }
    onSubmit({ title: t, description: description.trim(), estimatedMinutes, goalId: selectedGoalId ?? undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Title â€” primary */}
      <div>
        <label className={labelCls}>Task name</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className={inputCls}
          autoFocus
          required
          maxLength={200}
        />
      </div>

      {/* Duration â€” prominent */}
      <div>
        <label className={labelCls}>How long?</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setEstimatedMinutes(m)}
              className={`${mono.className} px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                estimatedMinutes === m
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'border-white/[0.07] text-slate-500 hover:border-white/[0.12] hover:text-slate-300'
              }`}
            >
              {formatDuration(m)}
            </button>
          ))}
          {/* Custom input */}
          <div className="flex items-center gap-1.5 border border-white/[0.07] rounded-xl px-3 py-2">
            <input
              type="number"
              min={5}
              max={480}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 30)}
              className={`${mono.className} w-10 bg-transparent text-white text-xs text-center focus:outline-none`}
            />
            <span className="text-slate-700 text-xs">min</span>
          </div>
        </div>
      </div>

      {/* Goal picker */}
      {activeGoals.length > 0 && (
        <div>
          <label className={labelCls}>Link to goal</label>
          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto rounded-2xl border border-white/[0.07] p-2">
            <GoalChipRow
              label="No goal"
              active={selectedGoalId === null}
              onClick={() => setSelectedGoalId(null)}
            />
            {activeGoals.map((g) => (
              <GoalChipRow
                key={g.id}
                label={g.title}
                active={selectedGoalId === g.id}
                onClick={() => setSelectedGoalId(g.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Optional details toggle */}
      <button
        type="button"
        onClick={() => setShowDetails((d) => !d)}
        className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
      >
        <span>{showDetails ? 'âˆ’' : '+'}</span>
        <span>{showDetails ? 'Hide details' : 'Add description'}</span>
      </button>

      {showDetails && (
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any extra contextâ€¦"
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={!title.trim()}
        className="w-full py-3.5 bg-gradient-to-r from-violet-500/80 to-cyan-500/80 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-2xl disabled:opacity-30 transition-all active:scale-[0.98] text-sm"
      >
        Create Task
      </button>
    </form>
  );
}

function GoalChipRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-all ${
        active
          ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300'
          : 'text-slate-400 hover:bg-white/[0.03] border border-transparent'
      }`}
    >
      <div
        className={`w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center ${
          active ? 'bg-violet-500 border-violet-500' : 'border-slate-600'
        }`}
      >
        {active && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      </div>
      <span className="truncate">{label}</span>
    </button>
  );
}

// â”€â”€â”€ Goal Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function GoalForm({
  timeSlots,
  goals,
  onSubmit,
}: {
  timeSlots: ReturnType<typeof useTimeSlots>['data'];
  goals: ReturnType<typeof useGoals>['data'];
  onSubmit: (input: CreateGoalInput) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<GoalLevel>('weekly');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [deadline, setDeadline] = useState('');
  const [timeSlotId, setTimeSlotId] = useState<string | null>(null);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeSlots = (timeSlots ?? []).filter((ts) => ts.isActive);
  const activeGoals = (goals ?? []).filter((g) => !g.isArchived);

  const toggleDep = (id: string) =>
    setDependsOn((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const t = title.trim();
    if (!t) { setError('Title required'); return; }
    if (t.length > 200) { setError('Title max 200 chars'); return; }
    onSubmit({
      title: t,
      description: description.trim(),
      level,
      metadata: getGoalMetadata(level),
      priority,
      timeSlotId: timeSlotId ?? undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      dependsOn: dependsOn.length ? dependsOn : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className={labelCls}>Goal title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you want to achieve?"
          className={inputCls}
          autoFocus
          required
          maxLength={200}
        />
      </div>

      {/* Level â€” always visible, minimal */}
      <div>
        <label className={labelCls}>Timeframe</label>
        <div className="flex gap-2 flex-wrap">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLevel(opt.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                level === opt.value
                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                  : 'border-white/[0.07] text-slate-500 hover:border-white/[0.12] hover:text-slate-300'
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority â€” always visible */}
      <div>
        <label className={labelCls}>Priority</label>
        <div className="grid grid-cols-3 gap-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                priority === opt.value
                  ? opt.active
                  : 'border-white/[0.07] text-slate-500 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((d) => !d)}
        className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
      >
        <span>{showAdvanced ? 'âˆ’' : '+'}</span>
        <span>{showAdvanced ? 'Hide options' : 'Deadline, time slot, dependencies'}</span>
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-1">
          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="More contextâ€¦"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Deadline */}
          <div>
            <label className={labelCls}>Target deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
          </div>

          {/* Time slot */}
          {activeSlots.length > 0 && (
            <div>
              <label className={labelCls}>Time slot</label>
              <div className="flex flex-col gap-1 rounded-2xl border border-white/[0.07] p-2">
                <SlotRow
                  label="No slot"
                  time=""
                  active={timeSlotId === null}
                  onClick={() => setTimeSlotId(null)}
                />
                {activeSlots.map((s) => (
                  <SlotRow
                    key={s.id}
                    label={s.name}
                    time={`${s.startTime}â€“${s.endTime}`}
                    active={timeSlotId === s.id}
                    onClick={() => setTimeSlotId(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Depends on */}
          {activeGoals.length > 0 && (
            <div>
              <label className={labelCls}>Depends on</label>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto rounded-2xl border border-white/[0.07] p-2">
                {activeGoals.map((g) => {
                  const sel = dependsOn.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleDep(g.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-all ${
                        sel
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                          : 'text-slate-400 hover:bg-white/[0.03] border border-transparent'
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center text-[8px] ${
                          sel ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-600'
                        }`}
                      >
                        {sel && 'âœ“'}
                      </div>
                      <span className="truncate">{g.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!title.trim()}
        className="w-full py-3.5 bg-gradient-to-r from-violet-500/80 to-cyan-500/80 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-2xl disabled:opacity-30 transition-all active:scale-[0.98] text-sm"
      >
        Create Goal
      </button>
    </form>
  );
}

function SlotRow({
  label,
  time,
  active,
  onClick,
}: {
  label: string;
  time: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
        active
          ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300'
          : 'text-slate-400 hover:bg-white/[0.03] border border-transparent'
      }`}
    >
      <div
        className={`w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center ${
          active ? 'bg-violet-500 border-violet-500' : 'border-slate-600'
        }`}
      >
        {active && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      </div>
      <span className="text-sm flex-1 truncate">{label}</span>
      {time && (
        <span className={`${mono.className} text-[10px] text-slate-600 flex-shrink-0`}>{time}</span>
      )}
    </button>
  );
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function CreatePage() {
  const router = useRouter();
  const { data: goals } = useGoals();
  const { data: timeSlots } = useTimeSlots();
  const addGoalMutation = useAddGoal();
  const addTaskMutation = useAddTask();
  const focusGoalIds = useAppStore((state) => state.focusGoalIds) ?? [];
  const [tab, setTab] = useState<'task' | 'goal'>('task');

  const handleCreateTask = (input: CreateTaskInput) => {
    addTaskMutation.mutate(input, { onSuccess: () => router.push('/dashboard') });
  };

  const handleCreateGoal = (input: CreateGoalInput) => {
    addGoalMutation.mutate(input, { onSuccess: () => router.push('/goals') });
  };

  return (
    <div style={{ paddingBottom: 'calc(var(--nav-h) + var(--safe-b) + 1rem)' }}>
      <h1 className="text-xl font-bold text-white mb-5">Create</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
        <button
          onClick={() => setTab('task')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
            tab === 'task' ? 'bg-violet-500/30 text-violet-200 border border-violet-500/30' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Task
        </button>
        <button
          onClick={() => setTab('goal')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
            tab === 'goal' ? 'bg-violet-500/30 text-violet-200 border border-violet-500/30' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Goal
        </button>
      </div>

      {tab === 'task' && (
        <TaskForm
          goals={goals}
          focusGoalIds={focusGoalIds}
          onSubmit={handleCreateTask}
        />
      )}

      {tab === 'goal' && (
        <GoalForm
          timeSlots={timeSlots}
          goals={goals}
          onSubmit={handleCreateGoal}
        />
      )}

      {/* Obsidian â€” moved to footer, unobtrusive */}
      <div className="mt-8 pt-6 border-t border-white/[0.04] flex justify-center">
        <button
          onClick={() => {
            const vault = process.env.NEXT_PUBLIC_OBSIDIAN_VAULT || 'Goal App';
            window.location.href = `obsidian://new?vault=${encodeURIComponent(vault)}&name=Untitled`;
          }}
          className="text-xs text-slate-700 hover:text-slate-500 transition-colors flex items-center gap-1.5"
        >
          <span>ðŸ“</span>
          <span>Open Obsidian instead</span>
        </button>
      </div>
    </div>
  );
}

