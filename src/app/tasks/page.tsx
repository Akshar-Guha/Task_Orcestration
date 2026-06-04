'use client';

import { useState } from 'react';
import { useGoals, useTasks, useCompleteTask, useDeleteTask, useUncompleteTask, useTaskGoalLinks } from '@/lib/hooks/useSupabase';

export default function TasksPage() {
  // React Query data
  const { data: tasks = [] } = useTasks();
  const { data: goals = [] } = useGoals();
  const { data: links = [] } = useTaskGoalLinks();
  const completeTaskMutation = useCompleteTask();
  const uncompleteTaskMutation = useUncompleteTask();
  const deleteTaskMutation = useDeleteTask();

  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  const filteredTasks = tasks.filter((t) => {
    if (t.isArchived) return false;
    if (filter === 'active') return !t.isCompleted;
    if (filter === 'completed') return t.isCompleted;
    return true;
  });

  return (
    <div
      className="min-h-screen" style={{ paddingBottom: 'calc(var(--nav-h) + var(--safe-b) + 1rem)' }}
      style={{ background: 'var(--bg)', fontFamily: 'var(--font-family-body)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1
              className="text-3xl font-semibold tracking-tight mb-1"
              style={{ fontFamily: 'var(--font-family-display)', color: 'var(--text)' }}
            >
              All Tasks
            </h1>
            <p
              className="text-sm"
              style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--text-2)' }}
            >
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filter tabs */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {(['active', 'completed', 'all'] as const).map((f) => {
              const isActive = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    minHeight: '44px',
                    paddingLeft: '14px',
                    paddingRight: '14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-family-body)',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    border: isActive ? '1px solid var(--gold)' : '1px solid transparent',
                    background: isActive ? 'var(--gold-dim)' : 'transparent',
                    color: isActive ? 'var(--gold)' : 'var(--text-3)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty state */}
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--jade-dim)', border: '1px solid var(--border)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--jade)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="text-center">
              <h2
                className="text-lg font-medium mb-1"
                style={{ color: 'var(--text)' }}
              >
                No tasks found
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Create a task to get started
              </p>
            </div>
            <a
              href="/create"
              style={{
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                paddingLeft: '24px',
                paddingRight: '24px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--bg)',
                background: 'var(--gold)',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                marginTop: '4px',
              }}
            >
              Create Task
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTasks.map((task) => {
              // Find linked goals
              const taskLinks = links.filter((l) => l.taskId === task.id);
              const linkedGoals = taskLinks.map((l) => ({
                goal: goals.find((g) => g.id === l.goalId),
                weight: l.contributionWeight,
              })).filter((g) => g.goal);

              return (
                <div
                  key={task.id}
                  className="group rounded-2xl"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    opacity: task.isCompleted ? 0.65 : 1,
                    transition: 'border-color 0.15s ease, opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!task.isCompleted) {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hi)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                  }}
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => {
                        if (task.isCompleted) {
                          uncompleteTaskMutation.mutate(task);
                        } else {
                          completeTaskMutation.mutate(task);
                        }
                      }}
                      style={{
                        marginTop: '2px',
                        minWidth: '20px',
                        minHeight: '20px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: task.isCompleted ? 'var(--jade-dim)' : 'transparent',
                        border: task.isCompleted ? '1.5px solid var(--jade)' : '1.5px solid var(--border-hi)',
                      }}
                    >
                      {task.isCompleted && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--jade)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="10 3 5 9 2 6" />
                        </svg>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3
                          className="font-medium text-sm leading-snug"
                          style={{
                            color: task.isCompleted ? 'var(--text-2)' : 'var(--text)',
                            textDecoration: task.isCompleted ? 'line-through' : 'none',
                          }}
                        >
                          {task.title}
                        </h3>
                        {task.isDaily && (
                          <span
                            style={{
                              fontFamily: 'var(--font-family-mono)',
                              fontSize: '10px',
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--jade)',
                              background: 'var(--jade-dim)',
                              border: '1px solid rgba(78,205,196,0.25)',
                              borderRadius: '5px',
                              padding: '2px 7px',
                            }}
                          >
                            Daily
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p
                          className="text-xs mb-2 line-clamp-1"
                          style={{ color: 'var(--text-2)' }}
                        >
                          {task.description}
                        </p>
                      )}

                      {/* Linked Goals Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {linkedGoals.length > 0 ? (
                          linkedGoals.map(({ goal, weight }) => (
                            <span
                              key={goal?.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontFamily: 'var(--font-family-mono)',
                                fontSize: '10px',
                                color: 'var(--text-2)',
                                background: 'var(--elevated)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                              }}
                            >
                              <span style={{ color: 'var(--text-2)' }}>{goal?.title}</span>
                              <span style={{ color: 'var(--violet)', fontWeight: 600 }}>{weight}%</span>
                            </span>
                          ))
                        ) : (
                          <span
                            style={{
                              fontFamily: 'var(--font-family-mono)',
                              fontSize: '10px',
                              color: 'var(--text-3)',
                              fontStyle: 'italic',
                            }}
                          >
                            No linked goals
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        if (confirm('Delete this task?')) deleteTaskMutation.mutate(task.id);
                      }}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-3)',
                        opacity: 0,
                        transition: 'color 0.15s ease, opacity 0.15s ease',
                        flexShrink: 0,
                      }}
                      className="group-hover:!opacity-100"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--coral)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)';
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
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

