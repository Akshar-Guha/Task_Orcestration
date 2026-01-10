'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import type { Goal, Task, TimeSlot, GoalLevel, GoalMetadata, TimeSlotType } from '@/lib/types';
import { TIME_SLOT_LABELS, TIME_SLOT_COLORS, DURATION_OPTIONS, formatDuration } from '@/lib/types';

type EditTab = 'timeslots' | 'goals' | 'tasks';

export default function EditPage() {
  const router = useRouter();
  const {
    timeSlots,
    goals,
    tasks,
    updateGoal,
    deleteGoal,
    updateTask,
    deleteTask,
    addTimeSlot,
    updateTimeSlot,
    deleteTimeSlot,
    addGoalToTimeSlot,
    removeGoalFromTimeSlot,
  } = useAppStore();

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

  const handleSave = () => {
    // Save time slots
    editingSlots.forEach((slot) => {
      const existing = timeSlots.find((ts) => ts.id === slot.id);
      if (existing) {
        updateTimeSlot(slot.id, slot);
      }
    });

    // Save goals
    editingGoals.forEach((g) => {
      updateGoal(g.id, g);
    });

    // Save tasks
    editingTasks.forEach((t) => {
      const original = tasks.find((task) => task.id === t.id);
      if (original) {
        updateTask(t.id, {
          title: t.title,
          description: t.description,
          estimatedMinutes: t.estimatedMinutes,
        });
      }
    });

    setHasChanges(false);
    router.push('/dashboard');
  };

  const handleCancel = () => {
    if (hasChanges && !confirm('Discard unsaved changes?')) return;
    router.push('/dashboard');
  };

  const addNewTimeSlot = () => {
    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}`,
      name: 'New Time Slot',
      type: 'work',
      startTime: '09:00',
      endTime: '12:00',
      color: TIME_SLOT_COLORS.work,
      goalIds: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setEditingSlots([...editingSlots, newSlot]);
    addTimeSlot({ name: newSlot.name, type: newSlot.type, startTime: newSlot.startTime, endTime: newSlot.endTime });
    setHasChanges(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-32">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Edit Mode</h1>
          <p className="text-sm text-slate-500">Manage time slots, goals, and tasks</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'timeslots' as EditTab, label: 'Time Slots', icon: '🕐' },
            { id: 'goals' as EditTab, label: 'Goals', icon: '🎯' },
            { id: 'tasks' as EditTab, label: 'Tasks', icon: '✅' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[500px]">
          {/* TIME SLOTS TAB */}
          {activeTab === 'timeslots' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Edit Time Slots</h2>
                <button
                  onClick={addNewTimeSlot}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-all"
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
                    {/* Slot Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="text"
                        value={slot.name}
                        onChange={(e) => {
                          setEditingSlots(
                            editingSlots.map((s) => (s.id === slot.id ? { ...s, name: e.target.value } : s))
                          );
                          setHasChanges(true);
                        }}
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-semibold focus:outline-none focus:border-violet-500"
                      />

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
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                      >
                        {Object.entries(TIME_SLOT_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => {
                            setEditingSlots(
                              editingSlots.map((s) => (s.id === slot.id ? { ...s, startTime: e.target.value } : s))
                            );
                            setHasChanges(true);
                          }}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                        />
                        <span className="text-slate-500">to</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => {
                            setEditingSlots(
                              editingSlots.map((s) => (s.id === slot.id ? { ...s, endTime: e.target.value } : s))
                            );
                            setHasChanges(true);
                          }}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                        />
                      </div>

                      <button
                        onClick={() => {
                          setEditingSlots(
                            editingSlots.map((s) => (s.id === slot.id ? { ...s, isActive: !s.isActive } : s))
                          );
                          setHasChanges(true);
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          slot.isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {slot.isActive ? '✓ Active' : '○ Inactive'}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Delete "${slot.name}"?`)) {
                            setEditingSlots(editingSlots.filter((s) => s.id !== slot.id));
                            deleteTimeSlot(slot.id);
                            setHasChanges(true);
                          }
                        }}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all"
                      >
                        🗑️
                      </button>
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
                      <span className="text-sm text-slate-500">{formatDuration(totalMinutes)} total</span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete goal "${goal.title}"?`)) {
                            setEditingGoals(editingGoals.filter((g) => g.id !== goal.id));
                            deleteGoal(goal.id);
                            setHasChanges(true);
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
                          deleteTask(task.id);
                          setHasChanges(true);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all"
                    >
                      Delete
                    </button>
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

        {/* Action Buttons */}
        <div className="fixed bottom-20 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-4 z-50">
          <div className="max-w-6xl mx-auto flex gap-4 justify-end">
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                hasChanges
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
