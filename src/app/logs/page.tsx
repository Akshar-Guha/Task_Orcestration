'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { TimelineEventType } from '@/lib/types';

const EVENT_CATEGORIES: { label: string; types: TimelineEventType[]; icon: string; color: string }[] = [
  {
    label: 'Task Completions',
    types: ['task_completed'],
    icon: '✅',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    label: 'Task Uncompleted',
    types: ['task_uncompleted'],
    icon: '↩️',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  },
  {
    label: 'Creations',
    types: ['task_created', 'goal_created'],
    icon: '➕',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  },
  {
    label: 'Goal Progress',
    types: ['goal_started', 'goal_completed'],
    icon: '🎯',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  },
];

export default function LogsPage() {
  const { timelineEvents, tasks, goals } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const events = timelineEvents || [];
  
  // Filter events by category
  const filteredEvents = selectedCategory === 'all' 
    ? events
    : events.filter(e => {
        const category = EVENT_CATEGORIES.find(c => c.types.includes(e.eventType));
        return category?.label === selectedCategory;
      });
  
  // Group by date
  const eventsByDate: Record<string, typeof events> = {};
  filteredEvents.forEach(event => {
    const date = event.timestamp.split('T')[0];
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push(event);
  });
  
  const dates = Object.keys(eventsByDate).sort().reverse();
  
  // Get event description
  const getEventDetails = (event: typeof events[0]) => {
    const task = tasks.find(t => t.id === event.taskId);
    const goal = goals.find(g => g.id === event.goalId);
    
    switch (event.eventType) {
      case 'task_completed':
        return {
          icon: '✅',
          text: event.details || (task ? `Completed "${task.title}"` : 'Completed a task'),
          color: 'text-emerald-400',
        };
      case 'task_uncompleted':
        return {
          icon: '↩️',
          text: event.details || (task ? `Uncompleted "${task.title}"` : 'Uncompleted a task'),
          color: 'text-orange-400',
        };
      case 'task_created':
        return {
          icon: '➕',
          text: event.details || (task ? `Created task "${task.title}"` : 'Created a task'),
          color: 'text-violet-400',
        };
      case 'goal_created':
        return {
          icon: '🎯',
          text: event.details || (goal ? `Created goal "${goal.title}"` : 'Created a goal'),
          color: 'text-violet-400',
        };
      case 'goal_started':
        return {
          icon: '🚀',
          text: event.details || (goal ? `Started goal "${goal.title}"` : 'Started a goal'),
          color: 'text-blue-400',
        };
      case 'goal_completed':
        return {
          icon: '🏆',
          text: event.details || (goal ? `Completed goal "${goal.title}"` : 'Completed a goal'),
          color: 'text-amber-400',
        };
      default:
        return { icon: '•', text: event.details || 'Activity', color: 'text-slate-500' };
    }
  };
  
  // Count by category
  const getCategoryCount = (categoryTypes: TimelineEventType[]) => {
    return events.filter(e => categoryTypes.includes(e.eventType)).length;
  };
  
  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Activity Logs</h1>
          <p className="text-sm text-slate-500">{events.length} total events</p>
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
            All ({events.length})
          </button>
          {EVENT_CATEGORIES.map((category) => {
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
        
        {/* Event Timeline */}
        {filteredEvents.length === 0 ? (
          <div className="p-12 bg-slate-900/50 border border-slate-800 rounded-xl text-center">
            <div className="text-5xl mb-3">📋</div>
            <h3 className="text-lg font-bold text-white mb-2">No Activity Yet</h3>
            <p className="text-slate-500">Start creating goals and completing tasks to see your activity history!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dates.map((date) => {
              const dateEvents = eventsByDate[date];
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
                    <span className="text-xs text-slate-600">{dateEvents.length} events</span>
                  </div>
                  
                  <div className="space-y-2">
                    {dateEvents.map((event) => {
                      const details = getEventDetails(event);
                      const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      });
                      
                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-all"
                        >
                          <span className="text-2xl flex-shrink-0">{details.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${details.color}`}>{details.text}</p>
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
