'use client';

import { useAppStore } from '@/lib/store';
import { useState } from 'react';

export default function TasksPage() {
  const { tasks, goals, links, completeTask, deleteTask } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  const filteredTasks = tasks.filter((t) => {
    if (t.isArchived) return false;
    if (filter === 'active') return !t.isCompleted;
    if (filter === 'completed') return t.isCompleted;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">All Tasks</h1>
            <p className="text-sm text-slate-500">{filteredTasks.length} tasks</p>
          </div>
          <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
            {(['active', 'completed', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  filter === f
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-2">No tasks found</h2>
            <p className="text-slate-500 mb-6">Create a task to get started</p>
            <a
              href="/create"
              className="inline-block px-6 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl"
            >
              Create Task
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              // Find linked goals
              const taskLinks = links.filter((l) => l.taskId === task.id);
              const linkedGoals = taskLinks.map((l) => ({
                goal: goals.find((g) => g.id === l.goalId),
                weight: l.contributionWeight,
              })).filter(g => g.goal);

              return (
                <div
                  key={task.id}
                  className={`group p-4 bg-slate-900/50 border rounded-xl transition-all ${
                    task.isCompleted ? 'border-emerald-500/30 opacity-75' : 'border-slate-800 hover:border-violet-500/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => completeTask(task.id)}
                      className={`mt-1 w-5 h-5 rounded flex items-center justify-center transition-all ${
                        task.isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'border-2 border-slate-600 hover:border-violet-400'
                      }`}
                    >
                      {task.isCompleted && <span className="text-xs">✓</span>}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium ${task.isCompleted ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {task.title}
                        </h3>
                        {task.isRepeating && (
                           <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                             Repeat ({task.completedCount}/{task.requiredCount})
                           </span>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className="text-xs text-slate-500 mb-2 line-clamp-1">{task.description}</p>
                      )}

                      {/* Linked Goals Tags */}
                      <div className="flex flex-wrap gap-2 mt-2">
                         {linkedGoals.length > 0 ? (
                           linkedGoals.map(({ goal, weight }) => (
                             <span key={goal?.id} className="inline-flex items-center gap-1 text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">
                               <span>🎯 {goal?.title}</span>
                               <span className="text-violet-400 font-bold">{weight}%</span>
                             </span>
                           ))
                         ) : (
                           <span className="text-[10px] text-slate-600 italic">No linked goals</span>
                         )}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (confirm('Delete this task?')) deleteTask(task.id);
                      }}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      🗑️
                    </button>
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
