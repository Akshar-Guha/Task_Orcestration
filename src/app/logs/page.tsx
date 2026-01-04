'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { ActivityType } from '@/lib/types';

const ACTIVITY_CATEGORIES: { label: string; types: ActivityType[]; icon: string; color: string }[] = [
  {
    label: 'Task Completions',
    types: ['task_completed'],
    icon: '✅',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    label: 'Task Progress',
    types: ['task_incremented'],
    icon: '📈',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  },
  {
    label: 'Creations',
    types: ['task_created', 'goal_created'],
    icon: '➕',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  },
  {
    label: 'Links',
    types: ['link_created'],
    icon: '🔗',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  },
];

export default function LogsPage() {
  const { activities, tasks, goals } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Filter activities by category
  const filteredActivities = selectedCategory === 'all' 
    ? activities
    : activities.filter(a => {
        const category = ACTIVITY_CATEGORIES.find(c => c.types.includes(a.type));
        return category?.label === selectedCategory;
      });
  
  // Group by date
  const activitiesByDate: Record<string, typeof activities> = {};
  filteredActivities.forEach(activity => {
    const date = activity.timestamp.split('T')[0];
    if (!activitiesByDate[date]) activitiesByDate[date] = [];
    activitiesByDate[date].push(activity);
  });
  
  const dates = Object.keys(activitiesByDate).sort().reverse();
  
  // Get activity description
  const getActivityDetails = (activity: typeof activities[0]) => {
    const task = tasks.find(t => t.id === activity.taskId);
    const goal = goals.find(g => g.id === activity.goalId);
    
    switch (activity.type) {
      case 'task_completed':
        return {
          icon: '✅',
          text: task ? `Completed "${task.title}"` : 'Completed a task',
          color: 'text-emerald-400',
        };
      case 'task_incremented':
        return {
          icon: '📈',
          text: task ? `Made progress on "${task.title}"` : 'Made progress',
          subtext: activity.details,
          color: 'text-blue-400',
        };
      case 'task_created':
        return {
          icon: '➕',
          text: task ? `Created task "${task.title}"` : 'Created a task',
          color: 'text-violet-400',
        };
      case 'goal_created':
        return {
          icon: '🎯',
          text: goal ? `Created goal "${goal.title}"` : 'Created a goal',
          color: 'text-violet-400',
        };
      case 'link_created':
        return {
          icon: '🔗',
          text: task && goal ? `Linked "${task.title}" to "${goal.title}"` : 'Created a link',
          subtext: activity.details,
          color: 'text-cyan-400',
        };
      default:
        return { icon: '•', text: 'Activity', color: 'text-slate-500' };
    }
  };
  
  // Count by category
  const getCategoryCount = (categoryTypes: ActivityType[]) => {
    return activities.filter(a => categoryTypes.includes(a.type)).length;
  };
  
  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Activity Logs</h1>
          <p className="text-sm text-slate-500">{activities.length} total activities</p>
        </div>
        
        {/* Category Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-white text-slate-900'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
            }`}
          >
            All ({activities.length})
          </button>
          {ACTIVITY_CATEGORIES.map((category) => {
            const count = getCategoryCount(category.types);
            return (
              <button
                key={category.label}
                onClick={() => setSelectedCategory(category.label)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category.label
                    ? `${category.color} border`
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {category.icon} {category.label} ({count})
              </button>
            );
          })}
        </div>
        
        {/* Activity Timeline */}
        {filteredActivities.length === 0 ? (
          <div className="p-12 bg-slate-900/50 border border-slate-800 rounded-xl text-center">
            <div className="text-5xl mb-3">📋</div>
            <h3 className="text-lg font-bold text-white mb-2">No Activity Yet</h3>
            <p className="text-slate-500">Start creating goals and completing tasks to see your activity history!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dates.map((date) => {
              const dateActivities = activitiesByDate[date];
              const dateObj = new Date(date);
              const isToday = date === new Date().toISOString().split('T')[0];
              const isYesterday = date === new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
              
              let dateLabel = dateObj.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              });
              
              if (isToday) dateLabel = `Today, ${dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
              if (isYesterday) dateLabel = `Yesterday, ${dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
              
              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-lg font-bold text-white">{dateLabel}</h2>
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-xs text-slate-600">{dateActivities.length} activities</span>
                  </div>
                  
                  <div className="space-y-2">
                    {dateActivities.map((activity) => {
                      const details = getActivityDetails(activity);
                      const time = new Date(activity.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      });
                      
                      return (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-all"
                        >
                          <span className="text-2xl flex-shrink-0">{details.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${details.color}`}>{details.text}</p>
                            {details.subtext && (
                              <p className="text-xs text-slate-600 mt-0.5">{details.subtext}</p>
                            )}
                            <p className="text-xs text-slate-600 mt-1">{time}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
