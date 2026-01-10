'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { formatDuration, LEVEL_LABELS, LEVEL_COLORS } from '@/lib/types';
import Link from 'next/link';

type ViewTab = 'goals' | 'productivity';

export default function TimelinePage() {
  const {
    goals,
    tasks,
    timeSlots,
    productivityLogs,
    getTodayProductivity,
    getGoalTimeSpent,
    getGoalTimelineStats,
    getTasksForGoal,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<ViewTab>('goals');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');

  const activeGoals = goals.filter((g) => !g.isArchived);
  const filteredGoals = activeGoals.filter((g) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return g.status !== 'completed';
    if (filterStatus === 'completed') return g.status === 'completed';
    return true;
  });

  const productivity = getTodayProductivity();

  // Get last 7 days of productivity
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const weeklyData = last7Days.map((date) => {
    const log = productivityLogs.find((l) => l.date === date);
    return {
      date,
      day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: log?.productiveMinutes || 0,
    };
  });

  const maxMinutes = Math.max(...weeklyData.map((d) => d.minutes), 60);

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Timeline & Progress</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('goals')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'goals'
                ? 'bg-violet-500 text-white'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            🎯 Goals
          </button>
          <button
            onClick={() => setActiveTab('productivity')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'productivity'
                ? 'bg-violet-500 text-white'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            📊 Productivity
          </button>
        </div>

        {/* GOALS TAB */}
        {activeTab === 'goals' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 mb-4">
              {[
                { id: 'all' as const, label: 'All' },
                { id: 'active' as const, label: 'Active' },
                { id: 'completed' as const, label: 'Completed' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setFilterStatus(filter.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === filter.id
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800/50 text-slate-500 hover:text-slate-400'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Goals List */}
            {filteredGoals.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-slate-400 mb-4">No goals yet</p>
                <Link
                  href="/create"
                  className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-all"
                >
                  Create Your First Goal
                </Link>
              </div>
            ) : (
              filteredGoals
                .sort((a, b) => {
                  // Sort by status: in_progress first, then not_started, then completed
                  const statusOrder = { in_progress: 0, not_started: 1, completed: 2 };
                  return statusOrder[a.status] - statusOrder[b.status];
                })
                .map((goal) => {
                  const stats = getGoalTimelineStats(goal.id);
                  const goalTasks = getTasksForGoal(goal.id);
                  const slot = timeSlots.find((ts) => ts.goalIds?.includes(goal.id));
                  
                  const statusConfig = {
                    not_started: { icon: '🟡', label: 'Not Started', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
                    in_progress: { icon: '🔵', label: 'In Progress', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
                    completed: { icon: '🟢', label: 'Completed', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
                  }[goal.status];

                  const progress = stats.tasksTotal > 0 
                    ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) 
                    : 0;

                  return (
                    <div
                      key={goal.id}
                      className={`p-4 rounded-xl ${statusConfig.bg} border ${statusConfig.border}`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-1">{goal.title}</h3>
                          <div className="flex items-center gap-3 text-sm">
                            <span className={statusConfig.bg + ' px-2 py-0.5 rounded'}>
                              {statusConfig.icon} {statusConfig.label}
                            </span>
                            <span className="text-slate-500">
                              {LEVEL_LABELS[goal.level]}
                            </span>
                            {slot && (
                              <span className="text-slate-600">
                                • {slot.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-violet-400">
                            {formatDuration(stats.minutesSpent)}
                          </div>
                          <div className="text-xs text-slate-500">spent</div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>{stats.tasksCompleted} of {stats.tasksTotal} tasks</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Task Breakdown */}
                      {goalTasks.length > 0 && (
                        <div className="border-t border-slate-700/50 pt-3 mt-3">
                          <h4 className="text-xs text-slate-500 uppercase mb-2">Task Breakdown</h4>
                          <div className="space-y-1">
                            {goalTasks.slice(0, 5).map((task) => (
                              <div key={task.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={task.isCompleted ? 'text-emerald-400' : 'text-slate-500'}>
                                    {task.isCompleted ? '✓' : '○'}
                                  </span>
                                  <span className={task.isCompleted ? 'text-slate-400' : 'text-slate-300'}>
                                    {task.title}
                                  </span>
                                </div>
                                <span className={`text-xs ${task.isCompleted ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  {task.estimatedMinutes}m
                                </span>
                              </div>
                            ))}
                            {goalTasks.length > 5 && (
                              <div className="text-xs text-slate-500 pt-1">
                                +{goalTasks.length - 5} more tasks
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
                        <span>📅 {stats.totalDays} days old</span>
                        {goal.completedAt && (
                          <span>✓ Completed {new Date(goal.completedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* PRODUCTIVITY TAB */}
        {activeTab === 'productivity' && (
          <div className="space-y-6">
            {/* Today Summary */}
            <div className="p-6 bg-gradient-to-br from-violet-900/30 to-slate-900/50 border border-violet-500/30 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Today&apos;s Productivity</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-3xl font-bold text-violet-400">
                    {formatDuration(productivity.todayMinutes)}
                  </div>
                  <div className="text-sm text-slate-500">Productive time</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-cyan-400">
                    {productivity.todayPercentage}%
                  </div>
                  <div className="text-sm text-slate-500">Of waking hours</div>
                </div>
              </div>
              <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
                  style={{ width: `${Math.min(100, productivity.todayPercentage)}%` }}
                />
              </div>
            </div>

            {/* Weekly Chart */}
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Last 7 Days</h3>
              <div className="flex items-end justify-between gap-2 h-32">
                {weeklyData.map((day, idx) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t transition-all ${
                          idx === 6 ? 'bg-violet-500' : 'bg-slate-700'
                        }`}
                        style={{
                          height: `${maxMinutes > 0 ? (day.minutes / maxMinutes) * 100 : 0}%`,
                          minHeight: day.minutes > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-2">{day.day}</div>
                    <div className="text-xs text-slate-600">{formatDuration(day.minutes)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Week Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                <div className="text-2xl font-bold text-white">
                  {formatDuration(productivity.weekMinutes)}
                </div>
                <div className="text-sm text-slate-500">This week total</div>
              </div>
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                <div className="text-2xl font-bold text-white">
                  {formatDuration(productivity.weeklyAverage)}
                </div>
                <div className="text-sm text-slate-500">Daily average</div>
              </div>
            </div>

            {/* Top Goals */}
            {productivity.topGoals.length > 0 && (
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-4">Today&apos;s Top Goals</h3>
                <div className="space-y-3">
                  {productivity.topGoals.map((item, idx) => {
                    const goal = goals.find((g) => g.id === item.goalId);
                    if (!goal) return null;
                    return (
                      <div key={item.goalId} className="flex items-center gap-3">
                        <span className="text-xl">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][idx]}</span>
                        <div className="flex-1">
                          <div className="text-white font-medium">{goal.title}</div>
                        </div>
                        <div className="text-violet-400 font-semibold">
                          {formatDuration(item.minutes)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
