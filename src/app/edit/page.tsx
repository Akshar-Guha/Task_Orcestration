'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  useGoals, useTasks, useTimeSlots, 
  useUpdateGoal, useDeleteGoal, 
  useUpdateTask, useDeleteTask, 
  useAddTimeSlot, useUpdateTimeSlot, useDeleteTimeSlot 
} from '@/lib/hooks/useSupabase';
import type { Goal, Task, TimeSlot, TimeSlotType } from '@/lib/types';
import { TIME_SLOT_LABELS, TIME_SLOT_COLORS, formatDuration } from '@/lib/types';

type EditTab = 'timeslots' | 'goals' | 'tasks';

export default function EditPage() {
  const router = useRouter();
  
  // React Query hooks
  const { data: timeSlots = [] } = useTimeSlots();
  const { data: goals = [] } = useGoals();
  const { data: tasks = [] } = useTasks();
  
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const addTimeSlotMutation = useAddTimeSlot();
  const updateTimeSlotMutation = useUpdateTimeSlot();
  const deleteTimeSlotMutation = useDeleteTimeSlot();
  
  // UI State from store (focus only)
  const { focusGoalIds, toggleFocusGoal } = useAppStore();

  const [activeTab, setActiveTab] = useState<EditTab>('timeslots');
  const [hasChanges, setHasChanges] = useState(false);

  // Local editing state
  const [editingSlots, setEditingSlots] = useState<TimeSlot[]>([]);
  const [editingGoals, setEditingGoals] = useState<Goal[]>([]);
  const [editingTasks, setEditingTasks] = useState<Task[]>([]);

  // Initialize editing state
  useEffect(() => {
    setEditingSlots(JSON.parse(JSON.stringify(timeSlots)));
    setEditingGoals(JSON.parse(JSON.stringify(goals)));
    setEditingTasks(JSON.parse(JSON.stringify(tasks)));
  }, [timeSlots, goals, tasks]);

  const handleSave = async () => {
    const promises = [];

    // Save time slots
    for (const slot of editingSlots) {
      const existing = timeSlots.find((ts) => ts.id === slot.id);
      // Rough check for changes to minimize requests
      if (existing && JSON.stringify(existing) !== JSON.stringify(slot)) {
         promises.push(updateTimeSlotMutation.mutateAsync({ id: slot.id, updates: slot }));
      }
    }

    // Save goals
    for (const g of editingGoals) {
      const existing = goals.find(ex => ex.id === g.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(g)) {
        promises.push(updateGoalMutation.mutateAsync({ id: g.id, updates: g }));
      }
    }

    // Save tasks
    for (const t of editingTasks) {
      const existing = tasks.find(ex => ex.id === t.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(t)) {
        promises.push(updateTaskMutation.mutateAsync({ 
          id: t.id, 
          updates: {
            title: t.title,
            description: t.description,
            estimatedMinutes: t.estimatedMinutes,
            goalId: t.goalId,
            isDaily: t.isDaily
          }
        }));
      }
    }

    await Promise.all(promises);
    setHasChanges(false);
    router.push('/dashboard');
  };

  const handleCancel = () => {
    if (hasChanges && !confirm('Discard unsaved changes?')) return;
    router.push('/dashboard');
  };

  const addNewTimeSlot = () => {
    // Optimistic update for UI is handled by query invalidation, 
    // but here we are in "editing" mode local state.
    // Ideally we assume success or wait.
    // Since we are adding to server immediately:
    
    addTimeSlotMutation.mutate({ 
        name: 'New Time Slot', 
        type: 'work', 
        startTime: '09:00', 
        endTime: '12:00' 
    }, {
        onSuccess: () => {
            // Refetch will update timeSlots, and useEffect will update editingSlots.
            // But we might want to manually add to editingSlots to show it immediately if useEffect laggy?
            // Actually, useEffect will trigger on timeSlots change.
        }
    });
    // setHasChanges(true); // Technically saved to server, so no "unsaved" changes unless we edit it further.
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-32">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Edit Mode</h1>
          <p className="text-sm text-slate-500">Manage time slots, goals, and tasks</p>
        </div>

        {/* Tabs - Mobile Optimized */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4">
          {[
            { id: 'timeslots' as EditTab, label: 'Time Slots', icon: '🕐' },
            { id: 'goals' as EditTab, label: 'Goals', icon: '🎯' },
            { id: 'tasks' as EditTab, label: 'Tasks', icon: '✅' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              style={{ fontSize: '16px' }}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[500px]">
          {/* TIME SLOTS TAB */}
          {activeTab === 'timeslots' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-2xl font-bold text-white">Edit Time Slots</h2>
                <button
                  onClick={addNewTimeSlot}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-all"
                  style={{ fontSize: '16px' }}
                >
                  + Add Time Slot
                </button>
              </div>

              {editingSlots.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <div className="text-5xl mb-4">🕐</div>
                  <p className="text-slate-400 mb-4">No time slots yet. Add your first one!</p>
                </div>
              ) : (
                editingSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl"
                    style={{ borderLeftWidth: '4px', borderLeftColor: slot.color }}
                  >
                    {/* Slot Header - Mobile Optimized */}
                    <div className="space-y-3 mb-4">
                      {/* Name Input - Full Width */}
                      <input
                        type="text"
                        value={slot.name}
                        onChange={(e) => {
                          setEditingSlots(
                            editingSlots.map((s) => (s.id === slot.id ? { ...s, name: e.target.value } : s))
                          );
                          setHasChanges(true);
                        }}
                        className="w-full min-h-[44px] px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-semibold focus:outline-none focus:border-violet-500"
                        style={{ fontSize: '16px' }}
                        placeholder="Time slot name"
                      />

                      {/* Type Selector - Full Width */}
                      <select
                        value={slot.type}
                        onChange={(e) => {
                          const newType = e.target.value as TimeSlotType;
                          setEditingSlots(
                            editingSlots.map((s) =>
                              s.id === slot.id ? { ...s, type: newType, color: TIME_SLOT_COLORS[newType] } : s
                            )
                          );
                          setHasChanges(true);
                        }}
                        className="w-full min-h-[44px] px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                        style={{ fontSize: '16px' }}
                      >
                        {Object.entries(TIME_SLOT_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>

                      {/* Time Inputs - Stack on Mobile */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-400 px-1">Start</label>
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => {
                              setEditingSlots(
                                editingSlots.map((s) => (s.id === slot.id ? { ...s, startTime: e.target.value } : s))
                              );
                              setHasChanges(true);
                            }}
                            className="w-full min-h-[44px] px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                            style={{ fontSize: '16px' }}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-400 px-1">End</label>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => {
                              setEditingSlots(
                                editingSlots.map((s) => (s.id === slot.id ? { ...s, endTime: e.target.value } : s))
                              );
                              setHasChanges(true);
                            }}
                            className="w-full min-h-[44px] px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                            style={{ fontSize: '16px' }}
                          />
                        </div>
                      </div>

                      {/* Action Buttons - Full Width on Mobile */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            setEditingSlots(
                              editingSlots.map((s) => (s.id === slot.id ? { ...s, isActive: !s.isActive } : s))
                            );
                            setHasChanges(true);
                          }}
                          className={`min-h-[44px] px-2 py-3 rounded-lg font-medium transition-all text-sm flex items-center justify-center ${
                            slot.isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {slot.isActive ? '✓ Active' : '○ Inactive'}
                        </button>

                        <button
                          onClick={() => {
                            setEditingSlots(
                                editingSlots.map((s) => (s.id === slot.id ? { ...s, isNotificationEnabled: !s.isNotificationEnabled } : s))
                            );
                            setHasChanges(true);
                          }}
                          className={`min-h-[44px] px-2 py-3 rounded-lg font-medium transition-all text-sm flex items-center justify-center ${
                             slot.isNotificationEnabled !== false
                                 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                 : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {slot.isNotificationEnabled !== false ? '🔔 Notify' : '🔕 Muted'}
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Delete "${slot.name}"?`)) {
                            setEditingSlots(editingSlots.filter((s) => s.id !== slot.id));
                            deleteTimeSlotMutation.mutate(slot.id);
                            setHasChanges(true); 
                          }
                        }}
                        className="min-h-[44px] px-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all text-sm flex items-center justify-center"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {/* Goals in this slot */}
                  <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-400 mb-2">
                        Goals in this slot ({(slot.goalIds || []).length})
                      </h4>

                      {(slot.goalIds || []).length > 0 ? (
                        <div className="space-y-2 pl-4 border-l-2 border-violet-500/50">
                          {(slot.goalIds || []).map((goalId) => {
                            const goal = editingGoals.find((g) => g.id === goalId);
                            if (!goal) return null;

                            const goalTasks = editingTasks.filter((t) => t.goalId === goal.id);
                            const completedTasks = goalTasks.filter((t) => t.isCompleted).length;

                            return (
                              <div key={goal.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span>🎯</span>
                                  <div>
                                    <span className="text-white font-medium">{goal.title}</span>
                                    <span className="text-sm text-slate-500 ml-2">
                                      ({completedTasks}/{goalTasks.length} tasks)
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingSlots(
                                      editingSlots.map((s) =>
                                        s.id === slot.id
                                          ? { ...s, goalIds: (s.goalIds || []).filter((id) => id !== goal.id) }
                                          : s
                                      )
                                    );
                                    setHasChanges(true);
                                  }}
                                  className="text-red-400 hover:text-red-300 text-sm px-2"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic pl-4">No goals assigned to this time slot</p>
                      )}

                      {/* Add Goal Dropdown */}
                      {(() => {
                        const unlinkedGoals = editingGoals.filter(
                          (g) => !(slot.goalIds || []).includes(g.id) && !g.isArchived
                        );
                        return (
                          unlinkedGoals.length > 0 && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  setEditingSlots(
                                    editingSlots.map((s) =>
                                      s.id === slot.id
                                        ? { ...s, goalIds: [...(s.goalIds || []), e.target.value] }
                                        : s
                                    )
                                  );
                                  setHasChanges(true);
                                  e.target.value = '';
                                }
                              }}
                              className="w-full mt-2 px-3 py-2 bg-slate-800 border border-dashed border-slate-600 rounded-lg text-slate-400 focus:outline-none focus:border-violet-500"
                              defaultValue=""
                            >
                              <option value="">+ Add a goal to this slot...</option>
                              {unlinkedGoals.map((goal) => (
                                <option key={goal.id} value={goal.id}>
                                  🎯 {goal.title}
                                </option>
                              ))}
                            </select>
                          )
                        );
                      })()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* GOALS TAB */}
          {activeTab === 'goals' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Edit Goals</h2>
              {editingGoals.filter((g) => !g.isArchived).map((goal) => {
                const goalTasks = editingTasks.filter((t) => t.goalId === goal.id);
                const totalMinutes = goalTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

                return (
                  <div key={goal.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="text"
                        value={goal.title}
                        onChange={(e) => {
                          setEditingGoals(
                            editingGoals.map((g) => (g.id === goal.id ? { ...g, title: e.target.value } : g))
                          );
                          setHasChanges(true);
                        }}
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-semibold focus:outline-none focus:border-violet-500"
                      />
                      
                      {/* Time Slot Reassignment */}
                      <select
                        value={editingSlots.find(s => (s.goalIds || []).includes(goal.id))?.id || ''}
                        onChange={(e) => {
                          const newSlotId = e.target.value;
                          const currentSlot = editingSlots.find(s => (s.goalIds || []).includes(goal.id));
                          
                          // Remove from old slot
                          let newSlots = [...editingSlots];
                          if (currentSlot) {
                            newSlots = newSlots.map(s => s.id === currentSlot.id 
                              ? { ...s, goalIds: (s.goalIds || []).filter(id => id !== goal.id) }
                              : s
                            );
                          }
                          
                          // Add to new slot
                          if (newSlotId) {
                            newSlots = newSlots.map(s => s.id === newSlotId
                              ? { ...s, goalIds: [...(s.goalIds || []), goal.id] }
                              : s
                            );
                          }
                          
                          setEditingSlots(newSlots);
                          setHasChanges(true);
                        }}
                        className="px-2 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-300 max-w-[150px]"
                      >
                        <option value="">Unassigned</option>
                        {editingSlots.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <span className="text-sm text-slate-500">{formatDuration(totalMinutes)} total</span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete goal "${goal.title}"?`)) {
                            setEditingGoals(editingGoals.filter((g) => g.id !== goal.id));
                            deleteGoalMutation.mutate(goal.id);
                            // Deletions are immediate, no need to flag setHasChanges for SAVE button, 
                            // but maybe keep it for consistency? 
                            // If we save, we don't want to re-delete.
                            // But handleSave only iterates editingGoals.
                          }
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Status Selection */}
                    <div className="flex items-center gap-3 mb-3">
                      <label className="text-sm text-slate-400">Status:</label>
                      <div className="flex gap-2">
                        {(['not_started', 'in_progress', 'completed'] as const).map((status) => {
                          const isActive = goal.status === status;
                          const config = {
                            not_started: { icon: '🟡', label: 'Not Started', bg: 'bg-amber-500/20', border: 'border-amber-500' },
                            in_progress: { icon: '🔵', label: 'In Progress', bg: 'bg-blue-500/20', border: 'border-blue-500' },
                            completed: { icon: '🟢', label: 'Completed', bg: 'bg-emerald-500/20', border: 'border-emerald-500' },
                          }[status];

                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => {
                                setEditingGoals(
                                  editingGoals.map((g) => (g.id === goal.id ? { ...g, status } : g))
                                );
                                setHasChanges(true);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                                isActive
                                  ? `${config.bg} border ${config.border} text-white`
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              <span>{config.icon}</span>
                              <span>{config.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Priority Selection */}
                    <div className="flex items-center gap-3 mb-3">
                      <label className="text-sm text-slate-400">Priority:</label>
                      <div className="flex gap-2">
                        {([1, 2, 3] as const).map((priority) => {
                          const isActive = (goal.priority || 2) === priority;
                          const config = {
                            1: { color: 'bg-red-500', label: 'Critical', textColor: 'text-red-400' },
                            2: { color: 'bg-yellow-500', label: 'Important', textColor: 'text-yellow-400' },
                            3: { color: 'bg-green-500', label: 'Nice-to-have', textColor: 'text-green-400' },
                          }[priority];

                          return (
                            <button
                              key={priority}
                              type="button"
                              onClick={() => {
                                setEditingGoals(
                                  editingGoals.map((g) => (g.id === goal.id ? { ...g, priority } : g))
                                );
                                setHasChanges(true);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                                isActive
                                  ? `${config.color}/20 border border-current ${config.textColor}`
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${config.color}`} />
                              <span>{config.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Priority Focus Toggle */}
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => {
                          toggleFocusGoal(goal.id);
                          // For focus, we don't setHasChanges because it updates store immediately
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                          (focusGoalIds || []).includes(goal.id)
                            ? 'bg-amber-500/20 border border-amber-500 text-amber-400'
                            : 'bg-slate-800 text-slate-400 hover:bg-amber-500/10 hover:text-amber-400'
                        }`}
                      >
                        <span>⭐</span>
                        <span>{(focusGoalIds || []).includes(goal.id) ? 'Priority Focused' : 'Set as Priority'}</span>
                      </button>
                    </div>

                    {/* Dependencies */}
                    <div className="mb-3 p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Dependencies</div>
                      
                      {/* Depends On */}
                      <div className="mb-2">
                        <label className="text-xs text-slate-400 block mb-1">This goal depends on:</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const newDeps = [...(goal.dependsOn || []), e.target.value];
                              setEditingGoals(
                                editingGoals.map((g) => (g.id === goal.id ? { ...g, dependsOn: newDeps } : g))
                              );
                              setHasChanges(true);
                              e.target.value = '';
                            }
                          }}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                          defaultValue=""
                        >
                          <option value="">+ Add dependency...</option>
                          {editingGoals
                            .filter(g => g.id !== goal.id && !g.isArchived && !(goal.dependsOn || []).includes(g.id))
                            .map(g => (
                              <option key={g.id} value={g.id}>{g.title}</option>
                            ))}
                        </select>
                        {(goal.dependsOn || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(goal.dependsOn || []).map(depId => {
                              const depGoal = editingGoals.find(g => g.id === depId);
                              return depGoal && (
                                <span key={depId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                                  {depGoal.title}
                                  <button
                                    onClick={() => {
                                      setEditingGoals(
                                        editingGoals.map(g => g.id === goal.id 
                                          ? { ...g, dependsOn: (g.dependsOn || []).filter(d => d !== depId) } 
                                          : g
                                        )
                                      );
                                      setHasChanges(true);
                                    }}
                                    className="hover:text-white"
                                  >×</button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Unlocks */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">This goal unlocks:</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const newUnlocks = [...(goal.unlocks || []), e.target.value];
                              setEditingGoals(
                                editingGoals.map((g) => (g.id === goal.id ? { ...g, unlocks: newUnlocks } : g))
                              );
                              setHasChanges(true);
                              e.target.value = '';
                            }
                          }}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                          defaultValue=""
                        >
                          <option value="">+ Add unlocks...</option>
                          {editingGoals
                            .filter(g => g.id !== goal.id && !g.isArchived && !(goal.unlocks || []).includes(g.id))
                            .map(g => (
                              <option key={g.id} value={g.id}>{g.title}</option>
                            ))}
                        </select>
                        {(goal.unlocks || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(goal.unlocks || []).map(unlockId => {
                              const unlockGoal = editingGoals.find(g => g.id === unlockId);
                              return unlockGoal && (
                                <span key={unlockId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded">
                                  → {unlockGoal.title}
                                  <button
                                    onClick={() => {
                                      setEditingGoals(
                                        editingGoals.map(g => g.id === goal.id 
                                          ? { ...g, unlocks: (g.unlocks || []).filter(u => u !== unlockId) } 
                                          : g
                                        )
                                      );
                                      setHasChanges(true);
                                    }}
                                    className="hover:text-white"
                                  >×</button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={goal.description || ''}
                      onChange={(e) => {
                        setEditingGoals(
                          editingGoals.map((g) => (g.id === goal.id ? { ...g, description: e.target.value } : g))
                        );
                        setHasChanges(true);
                      }}
                      placeholder="Description..."
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                      rows={2}
                    />
                  </div>
                );
              })}
              {editingGoals.filter((g) => !g.isArchived).length === 0 && (
                <p className="text-slate-500 text-center py-8">No goals yet. Create one from the Create page!</p>
              )}
            </div>
          )}

          {/* TASKS TAB */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Edit Tasks</h2>
              {editingTasks.filter((t) => !t.isArchived).map((task) => (
                <div key={task.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => {
                        setEditingTasks(
                          editingTasks.map((t) => (t.id === task.id ? { ...t, title: e.target.value } : t))
                        );
                        setHasChanges(true);
                      }}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-semibold focus:outline-none focus:border-violet-500"
                    />

                    {/* Duration */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={480}
                        value={task.estimatedMinutes}
                        onChange={(e) => {
                          setEditingTasks(
                            editingTasks.map((t) =>
                              t.id === task.id ? { ...t, estimatedMinutes: parseInt(e.target.value) || 30 } : t
                            )
                          );
                          setHasChanges(true);
                        }}
                        className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center focus:outline-none focus:border-violet-500"
                      />
                      <span className="text-sm text-slate-500">min</span>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Delete task "${task.title}"?`)) {
                          setEditingTasks(editingTasks.filter((t) => t.id !== task.id));
                          deleteTaskMutation.mutate(task.id);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all"
                    >
                      Delete
                    </button>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      {/* Is Daily Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                        <input
                          type="checkbox"
                          checked={task.isDaily}
                          onChange={(e) => {
                            setEditingTasks(
                              editingTasks.map((t) => (t.id === task.id ? { ...t, isDaily: e.target.checked } : t))
                            );
                            setHasChanges(true);
                          }}
                          className="w-4 h-4 rounded border-slate-600 text-violet-600 focus:ring-violet-500 bg-slate-700"
                        />
                        <span className="text-sm text-slate-300">Daily Task</span>
                      </label>

                      {/* Goal Reassignment */}
                      <select
                        value={task.goalId}
                        onChange={(e) => {
                          setEditingTasks(
                            editingTasks.map((t) => (t.id === task.id ? { ...t, goalId: e.target.value } : t))
                          );
                          setHasChanges(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 max-w-[200px]"
                      >
                        {editingGoals.filter(g => !g.isArchived).map(g => (
                          <option key={g.id} value={g.id}>{g.title}</option>
                        ))}
                      </select>
                    </div>
                  <textarea
                    value={task.description || ''}
                    onChange={(e) => {
                      setEditingTasks(
                        editingTasks.map((t) => (t.id === task.id ? { ...t, description: e.target.value } : t))
                      );
                      setHasChanges(true);
                    }}
                    placeholder="Description..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                    rows={2}
                  />
                </div>
              ))}
              {editingTasks.filter((t) => !t.isArchived).length === 0 && (
                <p className="text-slate-500 text-center py-8">No tasks yet. Create one from the Create page!</p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - Mobile Optimized */}
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-4 z-50"
             style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={handleCancel}
              className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all order-2 sm:order-1"
              style={{ fontSize: '16px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-xl font-medium transition-all order-1 sm:order-2 ${
                hasChanges
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
              style={{ fontSize: '16px' }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
