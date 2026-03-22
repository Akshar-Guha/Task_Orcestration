'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useGoals, useTimeSlots, useAddGoal, useAddTask } from '@/lib/hooks/useSupabase';
import type { GoalLevel, CreateGoalInput, CreateTaskInput, GoalMetadata, TimeSlotType } from '@/lib/types';
import { DURATION_OPTIONS, formatDuration, TIME_SLOT_LABELS } from '@/lib/types';

const LEVEL_OPTIONS: { value: GoalLevel; label: string; emoji: string }[] = [
  { value: 'weekly', label: 'Weekly', emoji: '📅' },
  { value: 'monthly', label: 'Monthly', emoji: '📆' },
  { value: 'quarterly', label: 'Quarterly', emoji: '📊' },
  { value: 'yearly', label: 'Yearly', emoji: '🎯' },
  { value: 'uncategorized', label: 'Other', emoji: '📌' },
];

const PRIORITY_OPTIONS: { value: 1 | 2 | 3; label: string; color: string }[] = [
  { value: 1, label: 'Critical', color: 'bg-red-500' },
  { value: 2, label: 'Important', color: 'bg-yellow-500' },
  { value: 3, label: 'Nice-to-have', color: 'bg-green-500' },
];

export default function CreatePage() {
  const router = useRouter();

  const { data: goals = [] } = useGoals();
  const { data: timeSlots = [] } = useTimeSlots();
  const addGoalMutation = useAddGoal();
  const addTaskMutation = useAddTask();

  const focusGoalIds = useAppStore((state) => state.focusGoalIds);

  const [tab, setTab] = useState<'goal' | 'task'>('task');

  // Goal form
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalLevel, setGoalLevel] = useState<GoalLevel>('weekly');
  const [goalPriority, setGoalPriority] = useState<1 | 2 | 3>(2);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string | null>(null);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [goalError, setGoalError] = useState('');

  // Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState('');

  const getGoalMetadata = (level: GoalLevel): GoalMetadata => {
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
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalError('');
    const title = goalTitle.trim();
    if (!title) { setGoalError('Title is required'); return; }
    if (title.length > 200) { setGoalError('Title must be under 200 characters'); return; }

    const input: CreateGoalInput = {
      title,
      description: goalDescription.trim(),
      level: goalLevel,
      metadata: getGoalMetadata(goalLevel),
      priority: goalPriority,
      timeSlotId: selectedTimeSlotId || undefined,
      deadline: goalDeadline ? new Date(goalDeadline).toISOString() : undefined,
      dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
    };

    addGoalMutation.mutate(input);
    router.push('/dashboard');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError('');
    const title = taskTitle.trim();
    if (!title) { setTaskError('Title is required'); return; }
    if (title.length > 200) { setTaskError('Title must be under 200 characters'); return; }
    if (estimatedMinutes < 5 || estimatedMinutes > 480) {
      setTaskError('Duration must be between 5 and 480 minutes'); return;
    }

    const input: CreateTaskInput = {
      title,
      description: taskDescription.trim(),
      estimatedMinutes,
      goalId: selectedGoalId || undefined,
    };

    addTaskMutation.mutate(input);
    router.push('/dashboard');
  };

  const handleOpenObsidian = () => {
    const vaultName = process.env.NEXT_PUBLIC_OBSIDIAN_VAULT || 'Goal App';
    const encodedVault = encodeURIComponent(vaultName);
    window.location.href = `obsidian://new?vault=${encodedVault}&name=Untitled`;
  };

  const activeGoals = goals.filter((g) => !g.isArchived);
  const sortedGoals = [...activeGoals].sort((a, b) => {
    const aIsFocus = (focusGoalIds || []).includes(a.id) ? 1 : 0;
    const bIsFocus = (focusGoalIds || []).includes(b.id) ? 1 : 0;
    if (aIsFocus !== bIsFocus) return bIsFocus - aIsFocus;
    const statusOrder = { 'in_progress': 0, 'not_started': 1, 'completed': 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return (a.priority || 2) - (b.priority || 2);
  });
  const activeSlots = timeSlots.filter((ts) => ts.isActive);

  const toggleDependency = (goalId: string) => {
    setDependsOn(prev => prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]);
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Create New</h1>

        {/* Obsidian Launcher */}
        <button onClick={handleOpenObsidian} className="w-full mb-6 p-4 bg-purple-900/30 border-2 border-purple-500/50 hover:border-purple-500 rounded-xl flex items-center justify-between group transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-2xl">📝</div>
            <div className="text-left">
              <div className="text-white font-semibold">Open in Obsidian</div>
              <div className="text-xs text-purple-300">Create note in canvas</div>
            </div>
          </div>
          <div className="text-purple-400 group-hover:text-purple-300 transition-colors">→</div>
        </button>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('task')} className={`flex-1 py-3 rounded-xl font-medium transition-all ${tab === 'task' ? 'bg-violet-500 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>✅ Task</button>
          <button onClick={() => setTab('goal')} className={`flex-1 py-3 rounded-xl font-medium transition-all ${tab === 'goal' ? 'bg-violet-500 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>🎯 Goal</button>
        </div>

        {/* Task Form */}
        {tab === 'task' && (
          <form onSubmit={handleCreateTask} className="space-y-5">
            {taskError && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{taskError}</div>}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Task Name</label>
              <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g., Watch React tutorial" className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500" autoFocus required maxLength={200} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Description <span className="text-slate-700">(optional)</span></label>
              <textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Add more details..." rows={2} className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-3">Estimated Duration</label>
              <div className="flex items-center gap-3 mb-3">
                <input type="number" min={5} max={480} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 30)} className="w-24 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-lg font-semibold focus:outline-none focus:border-violet-500" />
                <span className="text-slate-400">minutes</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((mins) => (
                  <button key={mins} type="button" onClick={() => setEstimatedMinutes(mins)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${estimatedMinutes === mins ? 'bg-violet-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{formatDuration(mins)}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Link to Goal</label>
              <div className="bg-slate-900 border border-slate-800 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1">
                {activeGoals.length === 0 ? (
                  <div className="text-slate-500 text-sm p-2 text-center">No goals created yet.</div>
                ) : (<>
                  <button type="button" onClick={() => setSelectedGoalId(null)} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${selectedGoalId === null ? 'bg-slate-700/50 border border-slate-600' : 'hover:bg-slate-800 border border-transparent'}`}>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedGoalId === null ? 'bg-slate-500 border-slate-500' : 'border-slate-600'}`}>{selectedGoalId === null && <span className="w-2 h-2 bg-white rounded-full"></span>}</div>
                    <span className="text-sm text-slate-400">No linked goal (standalone task)</span>
                  </button>
                  {sortedGoals.map((goal) => {
                    const isSelected = selectedGoalId === goal.id;
                    const statusIcon = goal.status === 'completed' ? '🟢' : goal.status === 'in_progress' ? '🔵' : '🟡';
                    const slot = timeSlots.find((ts) => ts.goalIds?.includes(goal.id));
                    return (
                      <button key={goal.id} type="button" onClick={() => setSelectedGoalId(goal.id)} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-violet-500/20 border border-violet-500/50' : 'hover:bg-slate-800 border border-transparent'}`}>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-600'}`}>{isSelected && <span className="w-2 h-2 bg-white rounded-full"></span>}</div>
                        <span className="text-lg">{statusIcon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${isSelected ? 'text-violet-200' : 'text-slate-300'}`}>{goal.title}</div>
                          {slot && <div className="text-[10px] text-slate-500">{TIME_SLOT_LABELS[slot.type as TimeSlotType]}</div>}
                        </div>
                      </button>
                    );
                  })}
                </>)}
              </div>
            </div>
            <button type="submit" disabled={!taskTitle.trim()} className="w-full py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-40">✅ Create Task</button>
          </form>
        )}

        {/* Goal Form */}
        {tab === 'goal' && (
          <form onSubmit={handleCreateGoal} className="space-y-5">
            {goalError && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{goalError}</div>}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Goal Title</label>
              <input type="text" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} placeholder="What do you want to achieve?" className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500" required maxLength={200} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Description <span className="text-slate-700">(optional)</span></label>
              <textarea value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} placeholder="Add more details..." rows={3} className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
            </div>

            {/* Goal Level */}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Goal Level</label>
              <div className="flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setGoalLevel(opt.value)} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${goalLevel === opt.value ? 'bg-violet-500 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600'}`}>{opt.emoji} {opt.label}</button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setGoalPriority(opt.value)} className={`py-3 rounded-xl text-sm font-medium transition-all ${goalPriority === opt.value ? `${opt.color} text-white` : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600'}`}>{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Target Deadline <span className="text-slate-700">(optional)</span></label>
              <input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-violet-500 [color-scheme:dark]" />
            </div>

            {/* Depends On */}
            {activeGoals.length > 0 && (
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Depends On <span className="text-slate-700">(optional)</span></label>
                <div className="bg-slate-900 border border-slate-800 rounded-xl max-h-36 overflow-y-auto p-2 space-y-1">
                  {activeGoals.map((goal) => {
                    const isSelected = dependsOn.includes(goal.id);
                    return (
                      <button key={goal.id} type="button" onClick={() => toggleDependency(goal.id)} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${isSelected ? 'bg-amber-500/20 border border-amber-500/50' : 'hover:bg-slate-800 border border-transparent'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-600'}`}>{isSelected && '✓'}</div>
                        <span className={`text-sm truncate ${isSelected ? 'text-amber-200' : 'text-slate-400'}`}>{goal.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assign to Time Slot */}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Assign to Time Slot</label>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1">
                <button type="button" onClick={() => setSelectedTimeSlotId(null)} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${selectedTimeSlotId === null ? 'bg-slate-700/50 border border-slate-600' : 'hover:bg-slate-800 border border-transparent'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedTimeSlotId === null ? 'bg-slate-500 border-slate-500' : 'border-slate-600'}`}>{selectedTimeSlotId === null && <span className="w-2 h-2 bg-white rounded-full"></span>}</div>
                  <span className="text-sm text-slate-400">No time slot (unscheduled)</span>
                </button>
                {activeSlots.map((slot) => (
                  <button key={slot.id} type="button" onClick={() => setSelectedTimeSlotId(slot.id)} className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${selectedTimeSlotId === slot.id ? 'bg-violet-500/20 border border-violet-500/50' : 'hover:bg-slate-800 border border-transparent'}`}>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedTimeSlotId === slot.id ? 'bg-violet-500 border-violet-500' : 'border-slate-600'}`}>{selectedTimeSlotId === slot.id && <span className="w-2 h-2 bg-white rounded-full"></span>}</div>
                    <span className="text-lg">{TIME_SLOT_LABELS[slot.type].split(' ')[0]}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-300">{slot.name}</div>
                      <div className="text-[10px] text-slate-500">{slot.startTime} - {slot.endTime}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={!goalTitle.trim()} className="w-full py-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl disabled:opacity-40">🎯 Create Goal</button>
          </form>
        )}
      </div>
    </div>
  );
}
