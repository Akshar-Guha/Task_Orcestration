'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { ActivityEntry } from '@/lib/types';

// Get all days in the last year
function getLast365Days() {
  const days = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  return days;
}

export default function ProfilePage() {
  const { activities, getSleepStats } = useAppStore();
  const sleepStats = getSleepStats();
  
  // Group activities by date
  const activityByDate = useMemo(() => {
    const grouped: Record<string, ActivityEntry[]> = {};
    activities.forEach((activity) => {
      const date = activity.timestamp.split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(activity);
    });
    return grouped;
  }, [activities]);
  
  // Calculate completion percentage for a date
  const getCompletionPercentage = (date: string) => {
    const dayActivities = activityByDate[date] || [];
    if (dayActivities.length === 0) return 0;
    
    // Count task completions and increments
    const completions = dayActivities.filter(a => 
      a.type === 'task_completed' || a.type === 'task_incremented'
    ).length;
    
    // Count total task-related activities
    const totalTaskActivities = dayActivities.filter(a =>
      a.type === 'task_completed' || 
      a.type === 'task_incremented' ||
      a.type === 'task_created'
    ).length;
    
    if (totalTaskActivities === 0) return 0;
    
    // Calculate percentage
    return Math.round((completions / totalTaskActivities) * 100);
  };
  
  // Get color based on completion percentage
  const getColor = (percentage: number) => {
    if (percentage === 0) return 'bg-red-900 border border-red-700'; // Red: No activity
    if (percentage < 50) return 'bg-blue-600 border border-blue-500'; // Blue: Low (1%+)
    if (percentage < 100) return 'bg-yellow-500 border border-yellow-400'; // Yellow: Medium (50%+)
    return 'bg-emerald-500 border border-emerald-400'; // Green: High (100%)
  };
  
  // Streak calculation removed as replaced by Sleep Streak
  // const currentStreak = ...
  
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
  
  // Legacy stats removed
  // const totalActivity = ...
  
  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <Link 
              href="/edit"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <span>⚙️</span>
              <span>Edit System</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Link href="/sleep" className="block group">
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl group-hover:border-indigo-500/50 group-hover:bg-slate-900/80 transition-all cursor-pointer h-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 text-sm">Sleep Score</span>
                  <span className="text-xs text-indigo-400 group-hover:translate-x-1 transition-transform">→</span>
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
        <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-xl">
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
                      const activities = activityByDate[day] || [];
                      
                      return (
                        <div
                          key={dayIdx}
                          className={`w-4 h-4 rounded-sm transition-all hover:ring-2 hover:ring-violet-400 hover:scale-150 cursor-pointer ${
                            getColor(percentage)
                          }`}
                          title={`${date.toLocaleDateString()}\n${percentage}% completion\n${activities.length} activities`}
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
            💡 <b>Tip:</b> Go to <a href="/logs" className="underline">Logs</a> to see detailed activity timeline with categories
          </p>
        </div>
      </div>
    </div>
  );
}
