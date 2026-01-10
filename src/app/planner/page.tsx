'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDuration, TIME_SLOT_LABELS } from '@/lib/types';
import Link from 'next/link';

export default function PlannerPage() {
  // Subscribe to store state with individual selectors for reactivity
  const timeSlots = useAppStore((state) => state.timeSlots);
  const goals = useAppStore((state) => state.goals);
  const tasks = useAppStore((state) => state.tasks);
  const productivityLogs = useAppStore((state) => state.productivityLogs);
  
  const completeTask = useAppStore((state) => state.completeTask);
  const getTodayProductivity = useAppStore((state) => state.getTodayProductivity);
  const addGoalToTimeSlot = useAppStore((state) => state.addGoalToTimeSlot);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showUnscheduled, setShowUnscheduled] = useState(true);
  
  // Parse selected date
  const dateObj = new Date(selectedDate);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  
  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Get productivity for selected date
  const productivity = isToday ? getTodayProductivity() : {
    todayMinutes: productivityLogs.find(l => l.date === selectedDate)?.productiveMinutes || 0,
    todayPercentage: 0,
    weekMinutes: 0,
    weeklyAverage: 0,
    topGoals: [],
  };

  // Active time slots sorted by start time
  const activeSlots = useMemo(() => 
    timeSlots.filter((ts) => ts.isActive).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [timeSlots]
  );

  // Goals NOT assigned to any time slot
  const unscheduledGoals = useMemo(() => 
    goals.filter((g) => !g.isArchived && !timeSlots.some((ts) => ts.goalIds?.includes(g.id))),
    [goals, timeSlots]
  );

  // Tasks NOT assigned to any goal (standalone tasks)
  const standaloneTasks = useMemo(() => 
    tasks.filter((t) => !t.isArchived && !t.goalId),
    [tasks]
  );

  // Helper to get goals for a slot
  const getGoalsForSlot = (slotId: string) => {
    const slot = timeSlots.find((ts) => ts.id === slotId);
    if (!slot) return [];
    return goals.filter((g) => slot.goalIds?.includes(g.id) && !g.isArchived);
  };

  // Helper to get tasks for a goal
  const getTasksForGoal = (goalId: string) => {
    return tasks.filter((t) => t.goalId === goalId && !t.isArchived);
  };

  // Calculate time block position
  const getTimePosition = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleTaskClick = (taskId: string) => {
    completeTask(taskId);
  };

  // Calculate stats
  const totalSlots = activeSlots.length;
  const totalGoals = goals.filter(g => !g.isArchived).length;
  const scheduledGoals = goals.filter(g => !g.isArchived && timeSlots.some(ts => ts.goalIds?.includes(g.id))).length;
  const totalTasks = tasks.filter(t => !t.isArchived).length;
  const completedTasks = tasks.filter(t => !t.isArchived && t.isCompleted).length;

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">📅 Daily Planner</h1>
            <p className="text-sm text-slate-500">Plan your day with time blocks</p>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-all"
            >
              ←
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isToday ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {isToday ? 'Today' : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </button>
            <button
              onClick={() => navigateDate(1)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-all"
            >
              →
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-violet-900/30 to-slate-900/50 border border-violet-500/30 rounded-xl">
            <div className="text-2xl font-bold text-violet-400">{formatDuration(productivity.todayMinutes)}</div>
            <div className="text-xs text-slate-500">Productive Time</div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="text-2xl font-bold text-white">{totalSlots}</div>
            <div className="text-xs text-slate-500">Time Slots</div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="text-2xl font-bold text-emerald-400">{scheduledGoals}/{totalGoals}</div>
            <div className="text-xs text-slate-500">Goals Scheduled</div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <div className="text-2xl font-bold text-cyan-400">{completedTasks}/{totalTasks}</div>
            <div className="text-xs text-slate-500">Tasks Done</div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Unscheduled Panel */}
          <div className={`${showUnscheduled ? 'w-80' : 'w-12'} transition-all shrink-0`}>
            <button
              onClick={() => setShowUnscheduled(!showUnscheduled)}
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-t-xl flex items-center justify-between text-white font-medium"
            >
              {showUnscheduled ? (
                <>
                  <span>📋 Unscheduled</span>
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                    {unscheduledGoals.length + standaloneTasks.length}
                  </span>
                </>
              ) : (
                <span className="rotate-90">📋</span>
              )}
            </button>
            
            {showUnscheduled && (
              <div className="bg-slate-900/50 border border-t-0 border-slate-800 rounded-b-xl p-4 space-y-4 max-h-[600px] overflow-y-auto">
                
                {/* Unscheduled Goals */}
                {unscheduledGoals.length > 0 && (
                  <div>
                    <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Goals (No Time Slot)</h3>
                    <div className="space-y-2">
                      {unscheduledGoals.map((goal) => {
                        const goalTasks = getTasksForGoal(goal.id);
                        return (
                          <div key={goal.id} className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <span>🎯</span>
                              <span className="text-sm font-medium text-white">{goal.title}</span>
                            </div>
                            <div className="text-xs text-slate-500 mb-2">
                              {goalTasks.length} tasks • {formatDuration(goalTasks.reduce((s, t) => s + t.estimatedMinutes, 0))}
                            </div>
                            {/* Assign to slot dropdown */}
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  addGoalToTimeSlot(e.target.value, goal.id);
                                  e.target.value = '';
                                }
                              }}
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300"
                              defaultValue=""
                            >
                              <option value="">+ Assign to time slot...</option>
                              {activeSlots.map((slot) => (
                                <option key={slot.id} value={slot.id}>
                                  {TIME_SLOT_LABELS[slot.type]} ({slot.startTime})
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Standalone Tasks */}
                {standaloneTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Standalone Tasks</h3>
                    <div className="space-y-1">
                      {standaloneTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => handleTaskClick(task.id)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all hover:bg-slate-800 ${
                            task.isCompleted ? 'opacity-50' : ''
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                            task.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600'
                          }`}>
                            {task.isCompleted && '✓'}
                          </span>
                          <span className={`flex-1 text-left text-sm ${
                            task.isCompleted ? 'text-slate-500 line-through' : 'text-white'
                          }`}>
                            {task.title}
                          </span>
                          <span className="text-xs text-slate-500">{task.estimatedMinutes}m</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {unscheduledGoals.length === 0 && standaloneTasks.length === 0 && (
                  <div className="text-center py-6">
                    <div className="text-3xl mb-2">✨</div>
                    <p className="text-sm text-slate-500">All organized!</p>
                  </div>
                )}

                <Link
                  href="/create"
                  className="block w-full p-3 bg-violet-600/20 border border-violet-500/30 rounded-lg text-center text-violet-400 hover:bg-violet-600/30 transition-all"
                >
                  + Add New Task
                </Link>
              </div>
            )}
          </div>

          {/* Timeline View */}
          <div className="flex-1">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              {/* Timeline Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-semibold text-white">⏰ Daily Timeline</h2>
                <Link href="/edit" className="text-xs text-violet-400 hover:text-violet-300">
                  Edit Time Slots →
                </Link>
              </div>

              {/* Time Slots */}
              <div className="divide-y divide-slate-800/50">
                {activeSlots.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-5xl mb-4">🕐</div>
                    <p className="text-slate-400 mb-4">No time slots configured</p>
                    <Link
                      href="/edit"
                      className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-all"
                    >
                      Set Up Time Slots
                    </Link>
                  </div>
                ) : (
                  activeSlots.map((slot) => {
                    const slotGoals = getGoalsForSlot(slot.id);
                    const allSlotTasks = slotGoals.flatMap((g) => getTasksForGoal(g.id));
                    const slotCompletedTasks = allSlotTasks.filter((t) => t.isCompleted).length;
                    const slotTotalMinutes = allSlotTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
                    const slotCompletedMinutes = allSlotTasks.filter((t) => t.isCompleted).reduce((s, t) => s + t.estimatedMinutes, 0);
                    const progress = slotTotalMinutes > 0 ? Math.round((slotCompletedMinutes / slotTotalMinutes) * 100) : 0;

                    return (
                      <div key={slot.id} className="relative">
                        {/* Time Block Header */}
                        <div 
                          className="flex items-stretch"
                          style={{ borderLeft: `4px solid ${slot.color}` }}
                        >
                          {/* Time Column */}
                          <div className="w-20 p-4 flex flex-col items-center justify-center bg-slate-900/50 border-r border-slate-800">
                            <div className="text-lg font-bold text-white">{slot.startTime}</div>
                            <div className="text-xs text-slate-500">to</div>
                            <div className="text-sm text-slate-400">{slot.endTime}</div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 p-4">
                            {/* Slot Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{TIME_SLOT_LABELS[slot.type].split(' ')[0]}</span>
                                <h3 className="font-semibold text-white">{slot.name}</h3>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-xs text-slate-500">
                                  {slotCompletedTasks}/{allSlotTasks.length} tasks
                                </div>
                                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <div className="text-sm font-medium" style={{ color: slot.color }}>
                                  {formatDuration(slotCompletedMinutes)}/{formatDuration(slotTotalMinutes)}
                                </div>
                              </div>
                            </div>

                            {/* Goals & Tasks */}
                            {slotGoals.length === 0 ? (
                              <div className="text-sm text-slate-600 italic">
                                No goals assigned • <Link href="/edit" className="text-violet-400 hover:underline">Add goals</Link>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {slotGoals.map((goal) => {
                                  const goalTasks = getTasksForGoal(goal.id);
                                  const goalCompletedMinutes = goalTasks.filter(t => t.isCompleted).reduce((s, t) => s + t.estimatedMinutes, 0);

                                  return (
                                    <div key={goal.id} className="pl-4 border-l-2 border-violet-500/30">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span>🎯</span>
                                        <span className="font-medium text-white">{goal.title}</span>
                                        <span className="text-xs text-slate-500">
                                          ({formatDuration(goalCompletedMinutes)} done)
                                        </span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                                          goal.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                          goal.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                          'bg-amber-500/20 text-amber-400'
                                        }`}>
                                          {goal.status === 'completed' ? '✓' : goal.status === 'in_progress' ? '◐' : '○'}
                                        </span>
                                      </div>
                                      
                                      {goalTasks.length === 0 ? (
                                        <div className="text-xs text-slate-600 italic ml-6">No tasks</div>
                                      ) : (
                                        <div className="space-y-1 ml-2">
                                          {goalTasks.map((task) => (
                                            <button
                                              key={task.id}
                                              onClick={() => handleTaskClick(task.id)}
                                              className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all hover:bg-slate-800/50 ${
                                                task.isCompleted ? 'opacity-60' : ''
                                              }`}
                                            >
                                              <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${
                                                task.isCompleted
                                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                                  : 'border-slate-600'
                                              }`}>
                                                {task.isCompleted && '✓'}
                                              </span>
                                              <span className={`flex-1 text-left text-sm ${
                                                task.isCompleted ? 'text-slate-400 line-through' : 'text-white'
                                              }`}>
                                                {task.title}
                                              </span>
                                              <span className={`text-xs px-2 py-0.5 rounded ${
                                                task.isCompleted
                                                  ? 'bg-emerald-500/20 text-emerald-400'
                                                  : 'bg-slate-700 text-slate-400'
                                              }`}>
                                                {task.estimatedMinutes}m
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Data Relationships Info */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <h3 className="text-sm font-semibold text-white mb-3">📊 Data Hierarchy</h3>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-cyan-500" />
              <span>Time Slots ({totalSlots})</span>
            </div>
            <span>→</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>Goals ({scheduledGoals} scheduled / {unscheduledGoals.length} unscheduled)</span>
            </div>
            <span>→</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-violet-500" />
              <span>Tasks ({totalTasks} total)</span>
            </div>
            <span>→</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span>Productivity ({formatDuration(productivity.todayMinutes)} today)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
