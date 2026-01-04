'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import type { Goal, Task, RoutineTemplate, GoalLevel, GoalMetadata } from '@/lib/types';

type EditTab = 'goals' | 'tasks' | 'routines' | 'sleep';

export default function EditPage() {
  const router = useRouter();
  const {
    lifeRoutines,
    goals,
    tasks,
    routineTemplates,
    updateGoal,
    deleteGoal,
    updateTask,
    deleteTask,
    createRoutineTemplate,
    updateRoutineTemplate,
    sleepWakeLogs,
    recordWakeUp,
    recordSleep,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<EditTab>('goals');
  const [hasChanges, setHasChanges] = useState(false);

  // Local state for editing
  // Local state for editing
  const [editingGoals, setEditingGoals] = useState<Goal[]>([]);
  const [editingTasks, setEditingTasks] = useState<Task[]>([]);
  const [editingRoutines, setEditingRoutines] = useState<RoutineTemplate[]>([]);

  // Initialize editing state
  useEffect(() => {
    // eslint-disable-next-line
    setEditingGoals(JSON.parse(JSON.stringify(goals)));
    // eslint-disable-next-line
    setEditingTasks(JSON.parse(JSON.stringify(tasks)));
    // eslint-disable-next-line
    setEditingRoutines(JSON.parse(JSON.stringify(routineTemplates)));
  }, [goals, tasks, routineTemplates]);

  const handleSave = () => {
    // Save all changes to store
    // Save goals
    editingGoals.forEach((g) => {
      updateGoal(g.id, g);
    });

    // Save tasks
    editingTasks.forEach((t) => {
      const original = tasks.find((task) => task.id === t.id);
      if (original) {
        // Only update if task exists
        const updates: Partial<Task> = {
          title: t.title,
          description: t.description,
          isRepeating: t.isRepeating,
          requiredCount: t.requiredCount,
        };
        updateTask(t.id, updates);
      }
    });

    // Save routines
    editingRoutines.forEach((r) => {
      const existing = routineTemplates.find((rt) => rt.id === r.id);
      if (existing) {
        updateRoutineTemplate(r.id, r);
      } else {
        // Create new
        const { id, createdAt, ...rest } = r;
        createRoutineTemplate(rest);
      }
    });

    setHasChanges(false);
    router.push('/profile');
  };

  const handleCancel = () => {
    if (hasChanges && !confirm('Discard unsaved changes?')) return;
    router.push('/profile');
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-32">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Edit Mode</h1>
          <p className="text-sm text-slate-500">Manage all your data in one place</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            // { id: 'dashboard' as EditTab, label: 'Life Routines', icon: '💪' },
            { id: 'goals' as EditTab, label: 'Goals', icon: '🎯' },
            { id: 'tasks' as EditTab, label: 'Tasks', icon: '✅' },
            { id: 'routines' as EditTab, label: 'Daily Routines', icon: '🌅' },
            { id: 'sleep' as EditTab, label: 'Sleep & Wake', icon: '🌙' },
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
          {/* DASHBOARD TAB */}


          {/* GOALS TAB */}
          {activeTab === 'goals' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Edit Goals</h2>
              {editingGoals.filter((g) => !g.isArchived).map((goal) => {
                const currentStatus = goal.status || 'not_started';
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
                      <select
                        value={goal.level}
                        onChange={(e) => {
                          const newLevel = e.target.value as GoalLevel;
                          const date = new Date();
                          let newMetadata: GoalMetadata;
                          
                          switch (newLevel) {
                            case 'yearly':
                              newMetadata = { type: 'yearly', year: date.getFullYear() };
                              break;
                            case 'quarterly':
                              newMetadata = { 
                                type: 'quarterly', 
                                year: date.getFullYear(), 
                                quarter: Math.ceil((date.getMonth() + 1) / 3) as 1 | 2 | 3 | 4 
                              };
                              break;
                            case 'monthly':
                              newMetadata = { 
                                type: 'monthly', 
                                year: date.getFullYear(), 
                                month: date.getMonth() + 1 
                              };
                              break;
                            case 'weekly':
                              // Calculate start of current week (Monday)
                              const weekStart = new Date(date);
                              weekStart.setDate(date.getDate() - date.getDay() + 1);
                              newMetadata = { 
                                type: 'weekly', 
                                weekStartDate: weekStart.toISOString().split('T')[0] 
                              };
                              break;
                            default:
                              newMetadata = { type: 'uncategorized' };
                          }

                          setEditingGoals(
                            editingGoals.map((g) => (g.id === goal.id ? { ...g, level: newLevel, metadata: newMetadata } : g))
                          );
                          setHasChanges(true);
                        }}
                        className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm font-medium text-slate-300 focus:outline-none focus:border-violet-500"
                      >
                        <option value="uncategorized">Unknown Level</option>
                        <option value="yearly">📅 Yearly</option>
                        <option value="quarterly">📊 Quarterly</option>
                        <option value="monthly">🌙 Monthly</option>
                        <option value="weekly">📆 Weekly</option>
                      </select>
                      <button
                        onClick={() => {
                          if (confirm(`Delete goal "${goal.title}"?`)) {
                            setEditingGoals(editingGoals.filter((g) => g.id !== goal.id));
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
                          const isActive = currentStatus === status;
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
                                const now = new Date().toISOString();
                                setEditingGoals(
                                  editingGoals.map((g) => {
                                    if (g.id !== goal.id) return g;
                                    const updates: Partial<Goal> = { status };
                                    if (status === 'in_progress' && !g.startedAt) {
                                      updates.startedAt = now;
                                    }
                                    if (status === 'completed' && !g.completedAt) {
                                      updates.completedAt = now;
                                    }
                                    return { ...g, ...updates };
                                  })
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
                    {task.isRepeating && (
                      <input
                        type="number"
                        value={task.requiredCount}
                        onChange={(e) => {
                          setEditingTasks(
                            editingTasks.map((t) =>
                              t.id === task.id ? { ...t, requiredCount: parseInt(e.target.value) || 1 } : t
                            )
                          );
                          setHasChanges(true);
                        }}
                        className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center focus:outline-none focus:border-violet-500"
                      />
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Delete task "${task.title}"?`)) {
                          setEditingTasks(editingTasks.filter((t) => t.id !== task.id));
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

          {/* ROUTINES TAB */}
          {activeTab === 'routines' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Edit Daily Routines</h2>
                <button
                  onClick={() => {
                    const newRoutine: RoutineTemplate = {
                      id: `routine-${Date.now()}`,
                      name: 'New Routine',
                      type: 'morning',
                      startTime: '09:00',
                      endTime: '10:00',
                      goalIds: [],
                      isActive: true,
                      createdAt: new Date().toISOString(),
                    };
                    setEditingRoutines([...editingRoutines, newRoutine]);
                    setHasChanges(true);
                  }}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-all"
                >
                  + Add Routine
                </button>
              </div>
              
              {editingRoutines.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <div className="text-5xl mb-4">🌅</div>
                  <p className="text-slate-400 mb-4">No routines yet. Add your first daily routine!</p>
                </div>
              ) : (
                editingRoutines.map((routine) => (
                  <div key={routine.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                    {/* Routine Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="text"
                        value={routine.name}
                        onChange={(e) => {
                          setEditingRoutines(
                            editingRoutines.map((r) => (r.id === routine.id ? { ...r, name: e.target.value } : r))
                          );
                          setHasChanges(true);
                        }}
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-semibold focus:outline-none focus:border-violet-500"
                      />
                      
                      {/* Type Selector */}
                      <select
                        value={routine.type}
                        onChange={(e) => {
                          setEditingRoutines(
                            editingRoutines.map((r) => (r.id === routine.id ? { ...r, type: e.target.value as RoutineTemplate['type'] } : r))
                          );
                          setHasChanges(true);
                        }}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                      >
                        <option value="morning">🌅 Morning</option>
                        <option value="work">💼 Work</option>
                        <option value="evening">🌆 Evening</option>
                        <option value="leisure">🎮 Leisure</option>
                      </select>
                      
                      {/* Time Range */}
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={routine.startTime}
                          onChange={(e) => {
                            setEditingRoutines(
                              editingRoutines.map((r) => (r.id === routine.id ? { ...r, startTime: e.target.value } : r))
                            );
                            setHasChanges(true);
                          }}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                        />
                        <span className="text-slate-500">to</span>
                        <input
                          type="time"
                          value={routine.endTime}
                          onChange={(e) => {
                            setEditingRoutines(
                              editingRoutines.map((r) => (r.id === routine.id ? { ...r, endTime: e.target.value } : r))
                            );
                            setHasChanges(true);
                          }}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      
                      {/* Toggle Active */}
                      <button
                        onClick={() => {
                          setEditingRoutines(
                            editingRoutines.map((r) => (r.id === routine.id ? { ...r, isActive: !r.isActive } : r))
                          );
                          setHasChanges(true);
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          routine.isActive 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {routine.isActive ? '✓ Active' : '○ Inactive'}
                      </button>
                      
                      {/* Delete Routine */}
                      <button
                        onClick={() => {
                          if (confirm(`Delete routine "${routine.name}"?`)) {
                            setEditingRoutines(editingRoutines.filter((r) => r.id !== routine.id));
                            setHasChanges(true);
                          }
                        }}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-all"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {/* Goals in this time slot */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-400 mb-2">
                        Goals in this time slot ({(routine.goalIds || []).length})
                      </h4>
                      
                      {(routine.goalIds || []).length > 0 ? (
                        <div className="space-y-2 pl-4 border-l-2 border-violet-500/50">
                          {(routine.goalIds || []).map((goalId) => {
                            const goal = editingGoals.find((g) => g.id === goalId);
                            if (!goal) return null;
                            
                            const goalTasks = editingTasks.filter((t) => t.goalId === goal.id);
                            const completedTasks = goalTasks.filter((t) => t.isCompleted).length;
                            const statusConfig = {
                              not_started: { icon: '🟡' },
                              in_progress: { icon: '🔵' },
                              completed: { icon: '🟢' },
                            }[(goal.status || 'not_started') as 'not_started' | 'in_progress' | 'completed'];
                            
                            return (
                              <div key={goal.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span>{statusConfig.icon}</span>
                                  <div>
                                    <span className="text-white font-medium">{goal.title}</span>
                                    <span className="text-sm text-slate-500 ml-2">
                                      ({completedTasks}/{goalTasks.length} tasks)
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingRoutines(
                                      editingRoutines.map((r) => 
                                        r.id === routine.id
                                          ? { ...r, goalIds: (r.goalIds || []).filter((id) => id !== goal.id) }
                                          : r
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
                        const unlinkedGoals = editingGoals.filter((g) => 
                          !(routine.goalIds || []).includes(g.id) && !g.isArchived
                        );
                        return unlinkedGoals.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setEditingRoutines(
                                  editingRoutines.map((r) => 
                                    r.id === routine.id
                                      ? { ...r, goalIds: [...(r.goalIds || []), e.target.value] }
                                      : r
                                  )
                                );
                                setHasChanges(true);
                                e.target.value = '';
                              }
                            }}
                            className="w-full mt-2 px-3 py-2 bg-slate-800 border border-dashed border-slate-600 rounded-lg text-slate-400 focus:outline-none focus:border-violet-500"
                            defaultValue=""
                          >
                            <option value="">+ Add a goal to this time slot...</option>
                            {unlinkedGoals.map((goal) => (
                              <option key={goal.id} value={goal.id}>
                                🎯 {goal.title} ({goal.level})
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}


          {/* SLEEP TAB */}
          {activeTab === 'sleep' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Edit Today&apos;s Sleep & Wake</h2>
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
                {(() => {
                  const today = new Date().toISOString().split('T')[0];
                  const todayLog = sleepWakeLogs.find(l => l.date === today);
                  
                  return (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Date: {today}</h3>
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                          Only today&apos;s data is editable
                        </span>
                      </div>
                      
                      {/* Wake Up Time */}
                      <div className="space-y-2">
                        <label className="block text-sm text-slate-400">Wake Up Time</label>
                        <div className="flex gap-4">
                          <input
                            type="time"
                            defaultValue={todayLog?.wakeUpTime || ''}
                            onChange={(e) => {
                              // We use the store action to update directly as this is a specific log type
                              // For simplicity in this edit mode, we can just update the record
                              if (e.target.value) {
                                // Calculate minutes ago is tricky here since we are setting absolute time
                                // So we'll need a way to just update the time string directly in the store
                                // BUT the user asked to restrict editing to today and valid times
                                // The current store `recordWakeUp` takes "minutesAgo".
                                // We might need a direct update or careful calculation.
                                
                                // Let's calculate deviation from NOW to pass to recordWakeUp?
                                // No, recordWakeUp creates a new entry if not exists.
                                // If we want to EDIT specific time, we need a store action for it or use the existing structure.
                                // Let's compute 'minutesAgo' relative to NOW to match the input time.
                                
                                const [hours, minutes] = e.target.value.split(':').map(Number);
                                const now = new Date();
                                const targetTime = new Date();
                                targetTime.setHours(hours, minutes, 0, 0);
                                
                                // If target is in future? shouldn't happen for wake up usually but possible if editing for later?
                                // If target is 8:00 AM and now is 12:00 PM, minutesAgo = 240.
                                let diff = Math.round((now.getTime() - targetTime.getTime()) / 60000);
                                if (diff < 0) diff = 0; // prevent future wake up logging if logic forbids it?
                                
                                recordWakeUp(diff, todayLog?.wakeUpMood);
                              }
                            }}
                            className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>

                      {/* Sleep Time */}
                      <div className="space-y-2">
                        <label className="block text-sm text-slate-400">Sleep Time (Going to Bed)</label>
                        <div className="flex gap-4">
                          <div className="flex-1">
                             {todayLog?.sleepTime ? (
                               <div className="flex items-center gap-4">
                                  <span className="text-xl font-mono text-white">{todayLog.sleepTime}</span>
                                  <button
                                    onClick={() => recordSleep()} 
                                    className="text-sm px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30"
                                  >
                                    Update to Now
                                  </button>
                               </div>
                             ) : (
                               <button
                                  onClick={() => recordSleep()}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all"
                               >
                                  Record Sleep Now
                               </button>
                             )}
                             <p className="text-xs text-slate-500 mt-2">
                               * Sleep time is recorded as the moment you click the button.
                             </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
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
