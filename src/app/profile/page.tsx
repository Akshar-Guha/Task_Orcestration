'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { TimelineEvent, formatDuration } from '@/lib/types';
import { useTimelineEvents, useSleepLogs, useProductivity, useGoals, useTasks } from '@/lib/hooks/useSupabase';

// Get all days from Jan 1, 2026 up to today (max 365 days)
function getLast365Days() {
  const days = [];
  const startDate = new Date('2026-01-01');
  const today = new Date();
  
  // Start from Jan 1, 2026 and go up to today
  const currentDate = new Date(startDate);
  while (currentDate <= today && days.length < 365) {
    days.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
}

export default function ProfilePage() {
  const { data: timelineEvents = [] } = useTimelineEvents();
  const { data: sleepLogs = [] } = useSleepLogs();
  const { data: productivityData } = useProductivity();
  const { data: goals = [] } = useGoals();
  const { data: tasks = [] } = useTasks();

  // Goal & Task stats
  const activeGoals = goals.filter(g => !g.isArchived);
  const completedGoals = activeGoals.filter(g => g.status === 'completed');
  const todayStr = new Date().toISOString().split('T')[0];
  const tasksDoneToday = tasks.filter(t => t.isCompleted && t.completedAt?.startsWith(todayStr)).length;
  const totalTasksDone = tasks.filter(t => t.isCompleted).length;

  // Helper to calculate sleep stats (previously in store)
  const sleepStats = useMemo(() => {
    if (sleepLogs.length === 0) return {
      averageMood: 0,
      averageSleepDuration: 0,
      sleepDebtMinutes: 0,
      streakDays: 0
    };

    const totalMood = sleepLogs.reduce((sum, log) => sum + (log.wakeUpMood || 0), 0);
    const totalDuration = sleepLogs.reduce((sum, log) => sum + (log.sleepDurationMinutes || 0), 0);
    const targetMinutes = 8 * 60;
    const totalDebt = sleepLogs.reduce((sum, log) => {
      if (!log.sleepDurationMinutes) return sum;
      return sum + (targetMinutes - log.sleepDurationMinutes);
    }, 0);

    return {
      averageMood: totalMood / (sleepLogs.length || 1) / 5, // Normalize to 0-1
      averageSleepDuration: Math.round(totalDuration / (sleepLogs.length || 1)),
      sleepDebtMinutes: totalDebt,
      streakDays: sleepLogs.length // Simple streak for now
    };
  }, [sleepLogs]);
  
  // Group timeline events by date (replacing activities)
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, TimelineEvent[]> = {};
    (timelineEvents || []).forEach((event) => {
      const date = event.timestamp.split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    return grouped;
  }, [timelineEvents]);
  
  // Calculate completion percentage for a date using productivity logs
  const getCompletionPercentage = (date: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dayLog = productivityData?.logs.find((l: any) => l.date === date);
    const dayEvents = eventsByDate[date] || [];
    
    if (dayLog && dayLog.productive_minutes > 0) {
      // Use productivity percentage (capped at 100)
      return Math.min(100, Math.round((dayLog.productive_minutes / (8 * 60)) * 100));
    }
    
    if (dayEvents.length === 0) return 0;
    
    // Count task completions
    const completions = dayEvents.filter(e => e.eventType === 'task_completed').length;
    const creations = dayEvents.filter(e => e.eventType === 'task_created').length;
    
    if (completions + creations === 0) return 0;
    return Math.round((completions / (completions + creations)) * 100);
  };
  
  // Get color based on completion percentage
  const getColor = (percentage: number) => {
    if (percentage === 0) return 'bg-red-900 border border-red-700'; // Red: No activity
    if (percentage < 50) return 'bg-blue-600 border border-blue-500'; // Blue: Low (1%+)
    if (percentage < 100) return 'bg-yellow-500 border border-yellow-400'; // Yellow: Medium (50%+)
    return 'bg-emerald-500 border border-emerald-400'; // Green: High (100%)
  };
  
  // Build calendar grid (52 weeks x 7 days)
  const days = getLast365Days();
  const weeks: string[][] = [];
  let currentWeek: string[] = [];
  
  days.forEach((day, idx) => {
    const date = new Date(day);
    const dayOfWeek = date.getDay();
    
    // Start new week on Sunday
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
    
    // Fill empty days at start
    if (idx === 0 && dayOfWeek > 0) {
      for (let i = 0; i < dayOfWeek; i++) {
        currentWeek.push('');
      }
    }
    
    currentWeek.push(day);
    
    // Push last week
    if (idx === days.length - 1) {
      weeks.push(currentWeek);
    }
  });
  
  return (
    <div className="min-h-screen bg-slate-950" style={{ paddingBottom: 'calc(var(--nav-h) + var(--safe-b) + 1rem)' }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <Link 
              href="/edit"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <span>âš™ï¸</span>
              <span>Edit System</span>
            </Link>
          </div>

          {/* Goals & Tasks Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Goals Completed</div>
              <div className="text-2xl font-bold text-emerald-400">{completedGoals.length}<span className="text-base text-slate-500 font-normal">/{activeGoals.length}</span></div>
              <div className="text-xs text-slate-500 mt-1">Active goals</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Tasks Today</div>
              <div className="text-2xl font-bold text-violet-400">{tasksDoneToday}</div>
              <div className="text-xs text-slate-500 mt-1">{totalTasksDone} total completed</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">This Week</div>
              <div className="text-2xl font-bold text-cyan-400">{formatDuration(productivityData?.weekMinutes || 0)}</div>
              <div className="text-xs text-slate-500 mt-1">Productive time</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Daily Average</div>
              <div className="text-2xl font-bold text-amber-400">{formatDuration(productivityData?.weeklyAverage || 0)}</div>
              <div className="text-xs text-slate-500 mt-1">This week</div>
            </div>
          </div>

          {/* Sleep Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Link href="/sleep" className="block group">
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl group-hover:border-indigo-500/50 group-hover:bg-slate-900/80 transition-all cursor-pointer h-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 text-sm">Sleep Score</span>
                  <span className="text-xs text-indigo-400 group-hover:translate-x-1 transition-transform">â†’</span>
                </div>
                <div className="text-2xl font-bold text-indigo-400">{Math.round(sleepStats.averageMood * 20)}%</div>
                <div className="text-xs text-slate-500 mt-1">View Logs</div>
              </div>
            </Link>
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Duration Avg</div>
              <div className="text-2xl font-bold text-violet-400">{Math.floor(sleepStats.averageSleepDuration / 60)}h {sleepStats.averageSleepDuration % 60}m</div>
              <div className="text-xs text-slate-500 mt-1">Last 7 days</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Sleep Debt</div>
              <div className={`text-2xl font-bold ${sleepStats.sleepDebtMinutes > 60 ? 'text-red-400' : 'text-emerald-400'}`}>
                {Math.floor(sleepStats.sleepDebtMinutes / 60)}h {sleepStats.sleepDebtMinutes % 60}m
              </div>
              <div className="text-xs text-slate-500 mt-1">Target: 8h/night</div>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Streak</div>
              <div className="text-2xl font-bold text-amber-400">{sleepStats.streakDays} Days</div>
              <div className="text-xs text-slate-500 mt-1">Consistent tracking</div>
            </div>
          </div>
        </div>
        
        {/* GitHub-style Contribution Graph - Full Width */}
        <div className="mt-6 p-8 bg-slate-900/50 border border-slate-800 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-6">365-Day Activity Map</h2>
          
          <div className="flex items-start gap-3">
            {/* Day labels */}
            <div className="flex flex-col gap-[4px] text-xs text-slate-600 pt-6">
              <div className="h-4 flex items-center">Mon</div>
              <div className="h-4"></div>
              <div className="h-4 flex items-center">Wed</div>
              <div className="h-4"></div>
              <div className="h-4 flex items-center">Fri</div>
              <div className="h-4"></div>
              <div className="h-4 flex items-center">Sun</div>
            </div>
            
            {/* Calendar grid - LARGER */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-[4px]">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-[4px]">
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                      const day = week[dayIdx];
                      if (!day) {
                        return <div key={dayIdx} className="w-4 h-4" />;
                      }
                      
                      const percentage = getCompletionPercentage(day);
                      const date = new Date(day);
                      const dayEvents = eventsByDate[day] || [];
                      
                      return (
                        <div
                          key={dayIdx}
                          className={`w-4 h-4 rounded-sm transition-all hover:ring-2 hover:ring-violet-400 hover:scale-150 cursor-pointer ${
                            getColor(percentage)
                          }`}
                          title={`${date.toLocaleDateString()}\n${percentage}% completion\n${dayEvents.length} events`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              
              {/* Month labels */}
              <div className="flex gap-[4px] mt-2">
                {weeks.map((week, idx) => {
                  if (idx % 4 === 0 && week[0]) {
                    const date = new Date(week[0]);
                    return (
                      <div key={idx} className="text-xs text-slate-600" style={{ width: '16px' }}>
                        {date.toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    );
                  }
                  return <div key={idx} style={{ width: '20px' }} />;
                })}
              </div>
              
              {/* Legend */}
              <div className="flex items-center gap-4 mt-6 pt-6 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-900 border border-red-700 rounded-sm" />
                  <span className="text-sm text-slate-400">No Activity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-600 border border-blue-500 rounded-sm" />
                  <span className="text-sm text-slate-400">Low (&lt;50%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 border border-yellow-400 rounded-sm" />
                  <span className="text-sm text-slate-400">Medium (50-99%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-emerald-500 border border-emerald-400 rounded-sm" />
                  <span className="text-sm text-slate-400">Perfect (100%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Tip */}
        <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl">
          <p className="text-sm text-violet-400">
            ðŸ’¡ <b>Tip:</b> Go to <a href="/logs" className="underline">Logs</a> to see detailed activity timeline with categories
          </p>
        </div>
      </div>
    </div>
  );
}

