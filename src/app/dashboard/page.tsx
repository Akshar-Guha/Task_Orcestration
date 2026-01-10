'use client';

import { useAppStore } from '@/lib/store';
import { SleepButton } from '@/components/sleep/SleepButton';
import { formatDuration, TIME_SLOT_LABELS } from '@/lib/types';
import Link from 'next/link';

export default function DashboardPage() {
  // Subscribe to all relevant state to ensure re-renders
  const timeSlots = useAppStore((state) => state.timeSlots);
  const goals = useAppStore((state) => state.goals);
  const tasks = useAppStore((state) => state.tasks);
  const productivityLogs = useAppStore((state) => state.productivityLogs);
  
  const completeTask = useAppStore((state) => state.completeTask);
  const initializeDefaultTimeSlots = useAppStore((state) => state.initializeDefaultTimeSlots);
  const getTodayProductivity = useAppStore((state) => state.getTodayProductivity);

  // Initialize default time slots if none exist
  if (timeSlots.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold text-white mb-3">Welcome to Goal Tracker!</h2>
            <p className="text-slate-400 mb-6">Let&apos;s set up your daily time slots</p>
            <button
              onClick={initializeDefaultTimeSlots}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-all"
            >
              Initialize Time Slots
            </button>
          </div>
        </div>
      </div>
    );
  }

  const productivity = getTodayProductivity();
  const activeSlots = timeSlots.filter((ts) => ts.isActive).sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Helper to get goals for a slot (computed locally to ensure reactivity)
  const getGoalsForSlot = (slotId: string) => {
    const slot = timeSlots.find((ts) => ts.id === slotId);
    if (!slot) return [];
    return goals.filter((g) => slot.goalIds.includes(g.id) && !g.isArchived);
  };

  // Helper to get tasks for a goal (computed locally to ensure reactivity)
  const getTasksForGoalLocal = (goalId: string) => {
    return tasks.filter((t) => t.goalId === goalId && !t.isArchived);
  };

  const handleTaskClick = (taskId: string) => {
    console.log('[Dashboard] Completing task:', taskId);
    completeTask(taskId);
  };

  return (
    <div className="space-y-6">
      {/* Header with Date */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Today</h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Productivity Bar */}
      <div className="p-4 bg-gradient-to-r from-violet-900/30 to-slate-900/50 border border-violet-500/30 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Today&apos;s Productivity</span>
          <span className="text-lg font-bold text-violet-400">
            {formatDuration(productivity.todayMinutes)} ({productivity.todayPercentage}%)
          </span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${Math.min(100, productivity.todayPercentage)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>0h</span>
          <span>4h</span>
          <span>8h</span>
          <span>12h</span>
          <span>16h</span>
        </div>
      </div>

      {/* Sleep/Wake Button */}
      <SleepButton />

      {/* Time Slots with Nested Goals & Tasks */}
      <div className="space-y-4">
        {activeSlots.map((slot) => {
          const slotGoals = getGoalsForSlot(slot.id);
          const allSlotTasks = slotGoals.flatMap((g) => getTasksForGoalLocal(g.id));
          const totalTasks = allSlotTasks.length;
          const completedTasks = allSlotTasks.filter((t) => t.isCompleted).length;
          const totalMinutes = allSlotTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
          const completedMinutes = allSlotTasks.filter((t) => t.isCompleted).reduce((s, t) => s + t.estimatedMinutes, 0);

          return (
            <div
              key={slot.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"
              style={{ borderLeftWidth: '4px', borderLeftColor: slot.color }}
            >
              {/* Time Slot Header */}
              <div className="p-4 flex items-center justify-between border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{TIME_SLOT_LABELS[slot.type].split(' ')[0]}</span>
                  <div>
                    <h2 className="font-semibold text-white">{slot.name}</h2>
                    <p className="text-xs text-slate-500">
                      {slot.startTime} - {slot.endTime}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium" style={{ color: slot.color }}>
                    {formatDuration(completedMinutes)} / {formatDuration(totalMinutes)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {completedTasks}/{totalTasks} tasks
                  </div>
                </div>
              </div>

              {/* Goals & Tasks */}
              <div className="p-4 space-y-4">
                {slotGoals.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-slate-500 text-sm">No goals in this time slot</p>
                    <Link
                      href="/edit"
                      className="text-violet-400 text-sm hover:text-violet-300 underline"
                    >
                      Add goals →
                    </Link>
                  </div>
                ) : (
                  slotGoals.map((goal) => {
                    const goalTasks = getTasksForGoalLocal(goal.id);
                    const goalCompletedMinutes = goalTasks
                      .filter((t) => t.isCompleted)
                      .reduce((sum, t) => sum + t.estimatedMinutes, 0);

                    return (
                      <div key={goal.id} className="space-y-2">
                        {/* Goal Header */}
                        <div className="flex items-center gap-2 pl-2 border-l-2 border-violet-500/50">
                          <span className="text-lg">🎯</span>
                          <div className="flex-1">
                            <span className="font-medium text-white">{goal.title}</span>
                            <span className="text-xs text-slate-500 ml-2">
                              ({formatDuration(goalCompletedMinutes)} spent)
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            goal.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                            goal.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {goal.status === 'completed' ? '✓ Done' : 
                             goal.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                          </span>
                        </div>

                        {/* Tasks */}
                        <div className="pl-6 space-y-1">
                          {goalTasks.length === 0 ? (
                            <p className="text-sm text-slate-600 italic">No tasks yet</p>
                          ) : (
                            goalTasks.map((task) => (
                              <button
                                key={task.id}
                                type="button"
                                onClick={() => handleTaskClick(task.id)}
                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all hover:bg-slate-800/50 ${
                                  task.isCompleted ? 'opacity-60' : ''
                                }`}
                              >
                                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
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
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="text-2xl font-bold text-white">{goals.filter((g) => !g.isArchived).length}</div>
          <div className="text-sm text-slate-500">Active Goals</div>
        </div>
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <div className="text-2xl font-bold text-emerald-400">
            {tasks.filter((t) => t.isCompleted && !t.isArchived).length}
          </div>
          <div className="text-sm text-slate-500">Tasks Completed</div>
        </div>
      </div>
    </div>
  );
}
