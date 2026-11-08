/**
 * Markdown Converter
 * 
 * Converts Supabase data to markdown format for Khoj indexing.
 * Uses actual schema from supabaseSync.ts.
 */

import type { Goal, Task, TimeSlot, SleepWakeLog } from '@/lib/types';
import { bodySectionMarkdown, type BodyFields } from '@/lib/health-markdown';

/**
 * Convert a Goal to markdown for Khoj
 */
export function goalToMarkdown(goal: Goal): string {
  const completionStats = goal.completionSnapshot
    ? `
## Completion Stats
- Tasks: ${goal.completionSnapshot.completedTasks}/${goal.completionSnapshot.totalTasks}
- Days to complete: ${goal.completionSnapshot.daysToComplete || 'N/A'}
- Active days: ${goal.completionSnapshot.activeDays || 'N/A'}
- Time spent: ${goal.completionSnapshot.totalMinutesSpent || 0} minutes
`
    : '';

  return `---
id: ${goal.id}
title: "${goal.title}"
level: ${goal.level}
status: ${goal.status}
priority: ${goal.priority || 2}
is_archived: ${goal.isArchived || false}
created_at: ${goal.createdAt}
${goal.startedAt ? `started_at: ${goal.startedAt}` : ''}
${goal.completedAt ? `completed_at: ${goal.completedAt}` : ''}
${goal.timeSlotId ? `time_slot_id: ${goal.timeSlotId}` : ''}
---

# ${goal.title}

${goal.description || '*No description*'}

## Status
${getStatusEmoji(goal.status)} ${goal.status.replace('_', ' ')}

## Priority
${getPriorityLabel(goal.priority || 2)}

${goal.dependsOn?.length ? `## Dependencies\n${goal.dependsOn.map(id => `- ${id}`).join('\n')}` : ''}

${goal.unlocks?.length ? `## Unlocks\n${goal.unlocks.map(id => `- ${id}`).join('\n')}` : ''}

${completionStats}
`;
}

/**
 * Convert a Task to markdown for Khoj
 */
export function taskToMarkdown(task: Task): string {
  return `---
id: ${task.id}
title: "${task.title}"
goal_id: ${task.goalId || 'none'}
is_completed: ${task.isCompleted}
is_daily: ${task.isDaily}
is_archived: ${task.isArchived || false}
estimated_minutes: ${task.estimatedMinutes || 30}
${task.actualMinutes ? `actual_minutes: ${task.actualMinutes}` : ''}
created_at: ${task.createdAt}
${task.completedAt ? `completed_at: ${task.completedAt}` : ''}
---

# Task: ${task.title}

${task.description || '*No description*'}

## Status
${task.isCompleted ? '✅ Completed' : '⏳ Pending'}

## Time
- Estimated: ${task.estimatedMinutes || 30} min
${task.actualMinutes ? `- Actual: ${task.actualMinutes} min` : ''}

${task.goalId ? `## Linked Goal\nGoal ID: ${task.goalId}` : '## Standalone Task'}
`;
}

/**
 * Convert a TimeSlot to markdown for Khoj
 */
export function timeSlotToMarkdown(slot: TimeSlot): string {
  return `---
id: ${slot.id}
name: "${slot.name}"
type: ${slot.type}
start_time: "${slot.startTime}"
end_time: "${slot.endTime}"
color: "${slot.color}"
is_active: ${slot.isActive}
---

# Time Slot: ${slot.name}

## Schedule
- Type: ${slot.type}
- Time: ${slot.startTime} - ${slot.endTime}

## Goals in this slot
${slot.goalIds?.length ? slot.goalIds.map(id => `- ${id}`).join('\n') : '*No goals assigned*'}
`;
}

/**
 * Convert a Memory (from Obsidian sync) to markdown for Khoj
 */
export function memoryToMarkdown(memory: {
  id: string;
  content: string;
  metadata?: { keywords?: string };
  createdAt: string;
}): string {
  return `---
id: ${memory.id}
type: memory
created_at: ${memory.createdAt}
${memory.metadata?.keywords ? `keywords: "${memory.metadata.keywords}"` : ''}
---

# Memory

${memory.content}

${memory.metadata?.keywords ? `\n**Keywords**: ${memory.metadata.keywords}` : ''}
`;
}

/**
 * Convert a SleepWakeLog to markdown for Khoj
 */
export function sleepLogToMarkdown(log: SleepWakeLog, health?: BodyFields | null): string {
  return `---
id: ${log.id}
date: ${log.date}
wake_up_time: ${log.wakeUpTime || 'N/A'}
sleep_time: ${log.sleepTime || 'N/A'}
sleep_duration_minutes: ${log.sleepDurationMinutes || 'N/A'}
wake_up_mood: ${log.wakeUpMood || 'N/A'}
---

# Sleep Log: ${log.date}

## Wake Up
- Time: ${log.wakeUpTime || 'Not recorded'}
- Mood: ${getMoodEmoji(log.wakeUpMood)} ${log.wakeUpMood || 'N/A'}

## Sleep
- Went to bed: ${log.sleepTime || 'Not recorded'}
- Duration: ${log.sleepDurationMinutes ? `${Math.floor(log.sleepDurationMinutes / 60)}h ${log.sleepDurationMinutes % 60}m` : 'N/A'}
${health ? `\n${bodySectionMarkdown(health)}` : ''}`;
}

/**
 * Convert one day's health_day row to markdown for Khoj (PLAN.md B6), so notes
 * are searchable by body state. Returns '' when there is no data.
 * Only index this into a self-hosted Khoj (KHOJ_URL), never a cloud LLM.
 */
export function healthDayToMarkdown(health: BodyFields & { date: string }): string {
  const body = bodySectionMarkdown(health);
  if (!body) return '';
  return `---
date: ${health.date}
type: health-day
illness_flag: ${health.illness_flag ? 'true' : 'false'}
---

# Day: ${health.date}

${body}`;
}

// Helper functions
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'completed': return '✅';
    case 'in_progress': return '🔄';
    case 'blocked': return '🚫';
    default: return '⏳';
  }
}

function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1: return '🔴 Critical';
    case 2: return '🟡 Important';
    case 3: return '🟢 Nice-to-have';
    default: return '🟡 Important';
  }
}

function getMoodEmoji(mood?: string | number): string {
  switch (mood) {
    case 'great': return '😊';
    case 'good': return '🙂';
    case 'okay': return '😐';
    case 'bad': return '😔';
    case 'terrible': return '😢';
    default: return '❓';
  }
}
