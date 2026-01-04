'use client';

import { useAppStore } from '@/lib/store';
import { LEVEL_LABELS, LEVEL_COLORS, type GoalLevel } from '@/lib/types';

const LEVELS: GoalLevel[] = ['yearly', 'quarterly', 'monthly', 'weekly'];
const LEVEL_ICONS: Record<GoalLevel, string> = {
  yearly: '🎯',
  quarterly: '📊',
  monthly: '📅',
  weekly: '📆',
  uncategorized: '❓',
};

export default function GoalsPage() {
  const { goals, tasks, getGoalProgress, getLinksForGoal, deleteGoal, loadSampleData, clearAll } = useAppStore();
  
  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Goals</h1>
            <p className="text-sm text-slate-500">{goals.filter(g => !g.isArchived).length} active</p>
          </div>
          <div className="flex gap-2">
            {goals.length === 0 && (
              <button
                onClick={loadSampleData}
                className="px-3 py-1.5 text-xs bg-violet-500/20 border border-violet-500/40 text-violet-400 rounded-lg"
              >
                Load Examples
              </button>
            )}
            {goals.length > 0 && (
              <button
                onClick={() => { if (confirm('Clear all?')) clearAll(); }}
                className="px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
        
        {goals.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-xl font-bold text-white mb-2">No goals yet</h2>
            <p className="text-slate-500 mb-6">Start by creating your first goal</p>
            <a
              href="/create"
              className="inline-block px-6 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl"
            >
              Create Goal
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {LEVELS.map((level) => {
              const levelGoals = goals.filter((g) => g.level === level && !g.isArchived);
              if (levelGoals.length === 0) return null;
              
              const colors = LEVEL_COLORS[level];
              
              return (
                <div key={level}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{LEVEL_ICONS[level]}</span>
                    <h2 className={`text-sm font-bold uppercase tracking-wider ${colors.text}`}>
                      {LEVEL_LABELS[level]}s ({levelGoals.length})
                    </h2>
                  </div>
                  
                  <div className="space-y-2">
                    {levelGoals.map((goal) => {
                      const progress = getGoalProgress(goal.id);
                      const links = getLinksForGoal(goal.id);
                      const linkedTasks = links.map(link => ({
                        task: tasks.find(t => t.id === link.taskId),
                        weight: link.contributionWeight
                      })).filter(item => item.task);
                      
                      return (
                        <details
                          key={goal.id}
                          className={`group p-4 rounded-xl border transition-all bg-slate-900/50 border-slate-800/50 hover:border-slate-700`}
                        >
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-start gap-3">
                              {/* Progress Ring */}
                              <div className="relative w-12 h-12 flex-shrink-0">
                                <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                                  <circle cx="18" cy="18" r="15" fill="none" stroke="#1e293b" strokeWidth="3" />
                                  <circle 
                                    cx="18" cy="18" r="15" fill="none" 
                                    stroke={progress === 100 ? '#22c55e' : colors.text.replace('text-', '#').replace('-400', '')}
                                    strokeWidth="3" strokeLinecap="round"
                                    strokeDasharray={`${progress * 0.942} 94.2`}
                                  />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                                  {progress}%
                                </span>
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white mb-1">{goal.title}</h3>
                                {goal.description && (
                                  <p className="text-xs text-slate-500 line-clamp-1">{goal.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-slate-600">{linkedTasks.length} linked tasks</span>
                                </div>
                              </div>
                              
                              {/* Delete */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this goal?')) deleteGoal(goal.id);
                                }}
                                className="text-slate-600 hover:text-red-400"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </summary>
                          
                          {/* Expanded content */}
                          <div className="mt-4 pt-4 border-t border-slate-800">
                            {linkedTasks.length === 0 ? (
                              <p className="text-xs text-slate-600 italic">
                                No linked tasks yet. Go to <a href="/planner" className="text-violet-400 underline">Map</a> to link tasks.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Linked Tasks</div>
                                {linkedTasks.map(({ task, weight }) => {
                                  if (!task) return null;
                                  const taskProgress = task.isRepeating 
                                    ? `${task.completedCount}/${task.requiredCount}`
                                    : task.isCompleted ? '✓' : '—';
                                  
                                  return (
                                    <div key={task.id} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                                      <span className="text-sm flex-1 text-slate-300">{task.title}</span>
                                      <span className="text-xs text-slate-500">{taskProgress}</span>
                                      <span className="text-xs font-bold text-violet-400">{weight}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </details>
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
