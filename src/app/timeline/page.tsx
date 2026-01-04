'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import type { Goal, TimelineEvent } from '@/lib/types';

// Status colors and icons
const STATUS_CONFIG = {
  not_started: { icon: '🟡', label: 'Not Started', bg: 'bg-amber-500/10', border: 'border-amber-500/50', text: 'text-amber-400' },
  in_progress: { icon: '🔵', label: 'In Progress', bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-400' },
  completed: { icon: '🟢', label: 'Completed', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-400' },
};

// Format relative time
const formatRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
};

// Format date
const formatDate = (timestamp: string) => {
  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Goal Card Component (Collapsible)
function GoalCard({ goal }: { goal: Goal }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { tasks, getTimelineEventsForGoal, getGoalTimelineStats } = useAppStore();
  
  const goalTasks = tasks.filter((t) => t.goalId === goal.id);
  const stats = getGoalTimelineStats(goal.id);
  const events = getTimelineEventsForGoal(goal.id);
  
  // Fallback for old goals without status
  const status = goal.status || 'not_started';
  const config = STATUS_CONFIG[status];
  
  const completedTasks = goalTasks.filter((t) => t.isCompleted).length;
  const progress = goalTasks.length > 0 ? Math.round((completedTasks / goalTasks.length) * 100) : 0;
  
  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden transition-all`}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div className="text-left">
            <h3 className="font-semibold text-white">{goal.title}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className={config.text}>{config.label}</span>
              <span>•</span>
              <span>{completedTasks}/{goalTasks.length} tasks</span>
              {status !== 'not_started' && (
                <>
                  <span>•</span>
                  <span>{stats.totalDays} days</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {goalTasks.length > 0 && (
            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-violet-500 transition-all" 
                style={{ width: `${progress}%` }} 
              />
            </div>
          )}
          <span className="text-slate-400 text-lg">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-700/50 p-4 space-y-4">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.tasksTotal}</div>
              <div className="text-xs text-slate-400">Total Tasks</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{stats.tasksCompleted}</div>
              <div className="text-xs text-slate-400">Completed</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{stats.totalDays}</div>
              <div className="text-xs text-slate-400">Days Since Created</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-violet-400">
                {goal.completionSnapshot?.activeDays || events.length}
              </div>
              <div className="text-xs text-slate-400">Active Days</div>
            </div>
          </div>
          
          {/* Timeline */}
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-400 mb-2">Created: {formatDate(goal.createdAt)}</div>
            {goal.startedAt && (
              <div className="text-sm text-blue-400">Started: {formatDate(goal.startedAt)}</div>
            )}
            {goal.completedAt && (
              <div className="text-sm text-emerald-400">Completed: {formatDate(goal.completedAt)}</div>
            )}
          </div>
          
          {/* Tasks List */}
          {goalTasks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Tasks</h4>
              <div className="space-y-1">
                {goalTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`flex items-center gap-2 p-2 rounded ${
                      task.isCompleted ? 'bg-emerald-500/10' : 'bg-slate-800/50'
                    }`}
                  >
                    <span>{task.isCompleted ? '✅' : '⬜'}</span>
                    <span className={task.isCompleted ? 'text-slate-400 line-through' : 'text-white'}>
                      {task.title}
                    </span>
                    {task.completedAt && (
                      <span className="text-xs text-slate-500 ml-auto">
                        {formatRelativeTime(task.completedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Recent Events */}
          {events.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Recent Activity</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {events.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">{formatRelativeTime(event.timestamp)}</span>
                    <span className="text-slate-400">{event.details}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Completion Snapshot (for completed goals) */}
          {status === 'completed' && goal.completionSnapshot && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <h4 className="text-sm font-medium text-emerald-400 mb-1">Completion Summary</h4>
              <p className="text-sm text-slate-300">
                Completed {goal.completionSnapshot.completedTasks}/{goal.completionSnapshot.totalTasks} tasks 
                in {goal.completionSnapshot.daysToComplete} days 
                ({goal.completionSnapshot.activeDays} active days)
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// Activity Feed Component
function ActivityFeed({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        No activity yet. Start completing tasks!
      </div>
    );
  }
  
  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = event.timestamp.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);
  
  return (
    <div className="space-y-4">
      {Object.entries(groupedEvents).slice(0, 5).map(([date, dayEvents]) => (
        <div key={date}>
          <div className="text-sm font-medium text-slate-400 mb-2">
            {formatDate(date + 'T00:00:00')}
          </div>
          <div className="space-y-1 border-l-2 border-slate-700 pl-4">
            {dayEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-2 text-sm">
                <span className="text-slate-500 w-16 shrink-0">
                  {new Date(event.timestamp).toLocaleTimeString('en-IN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
                <span className="text-slate-300">{event.details}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TimelinePage() {
  const { goals, tasks, getTimelineEvents } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  
  const timelineEvents = getTimelineEvents(100);
  
  const filteredGoals = useMemo(() => {
    if (statusFilter === 'all') return goals.filter((g) => !g.isArchived);
    return goals.filter((g) => (g.status || 'not_started') === statusFilter && !g.isArchived);
  }, [goals, statusFilter]);
  
  // Stats
  const stats = useMemo(() => ({
    total: goals.filter((g) => !g.isArchived).length,
    notStarted: goals.filter((g) => (g.status || 'not_started') === 'not_started' && !g.isArchived).length,
    inProgress: goals.filter((g) => g.status === 'in_progress' && !g.isArchived).length,
    completed: goals.filter((g) => g.status === 'completed' && !g.isArchived).length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.isCompleted).length,
  }), [goals, tasks]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Timeline</h1>
          <p className="text-sm text-slate-400">Track your goals and activities</p>
        </div>
      </div>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-slate-400">Total Goals</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="text-3xl font-bold text-amber-400">{stats.notStarted}</div>
          <div className="text-sm text-slate-400">Not Started</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="text-3xl font-bold text-blue-400">{stats.inProgress}</div>
          <div className="text-sm text-slate-400">In Progress</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <div className="text-3xl font-bold text-emerald-400">{stats.completed}</div>
          <div className="text-sm text-slate-400">Completed</div>
        </div>
      </div>
      
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'not_started', 'in_progress', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              statusFilter === filter
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {filter === 'all' ? 'All Goals' : STATUS_CONFIG[filter].label}
          </button>
        ))}
      </div>
      
      {/* Main Content - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Goals List */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold text-white">Goals</h2>
          {filteredGoals.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
              <p className="text-slate-400">No goals found. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </div>
        
        {/* Activity Feed Sidebar */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <ActivityFeed events={timelineEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}
