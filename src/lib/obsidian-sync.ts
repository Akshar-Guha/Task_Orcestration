/**
 * Obsidian Sync Service
 * 
 * Handles syncing data to Obsidian vault via GitHub API Proxy.
 * Converts app data to markdown format with proper folder structure.
 */

import type { Goal, Task, TimeSlot, SleepWakeLog, ProductivityLog } from './types';
import type { DailyEntry, Question, QuestionAnswer } from './diary-types';

// Schema version for migration support
const SCHEMA_VERSION = '2026.1';

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  error?: string;
}

interface SyncStatus {
  lastSync: string | null;
  pending: number;
  syncing: boolean;
  error: string | null;
}

// Singleton state
let syncStatus: SyncStatus = {
  lastSync: null,
  pending: 0,
  syncing: false,
  error: null,
};

// Queue for pending syncs
const syncQueue: Array<{ type: string; data: unknown; action: 'upsert' | 'delete' }> = [];
let isProcessingQueue = false;

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * Convert Goal to Obsidian markdown
 */
function goalToMarkdown(goal: Goal): string {
  const statusFolder = goal.status === 'completed' ? 'completed' 
    : goal.isArchived ? 'archive' : 'active';

  const completionStats = goal.completionSnapshot
    ? `
## Completion Stats
- Tasks Completed: ${goal.completionSnapshot.completedTasks}/${goal.completionSnapshot.totalTasks}
- Days to Complete: ${goal.completionSnapshot.daysToComplete || 'N/A'}
- Active Days: ${goal.completionSnapshot.activeDays || 'N/A'}
- Total Time: ${goal.completionSnapshot.totalMinutesSpent || 0} minutes
`
    : '';

  return `---
schema_version: "${SCHEMA_VERSION}"
id: "${goal.id}"
title: "${goal.title}"
description: "${(goal.description || '').replace(/"/g, '\\"')}"
level: "${goal.level}"
status: "${goal.status}"
priority: ${goal.priority || 2}
depends_on: ${JSON.stringify(goal.dependsOn || [])}
unlocks: ${JSON.stringify(goal.unlocks || [])}
time_slot_id: ${goal.timeSlotId ? `"${goal.timeSlotId}"` : 'null'}
is_archived: ${goal.isArchived || false}
created_at: "${goal.createdAt}"
started_at: ${goal.startedAt ? `"${goal.startedAt}"` : 'null'}
completed_at: ${goal.completedAt ? `"${goal.completedAt}"` : 'null'}
metadata:
  source: "mto-app"
  synced_at: "${new Date().toISOString()}"
  status_folder: "${statusFolder}"
---

# ${goal.title}

${goal.description || '*No description*'}

## Status
${getStatusEmoji(goal.status)} ${goal.status.replace('_', ' ')}

## Priority
${getPriorityLabel(goal.priority || 2)}

${completionStats}
`;
}

/**
 * Convert Task to Obsidian markdown
 */
function taskToMarkdown(task: Task): string {
  const folder = task.isCompleted ? 'completed' : 'active';

  return `---
schema_version: "${SCHEMA_VERSION}"
id: "${task.id}"
title: "${task.title}"
description: "${(task.description || '').replace(/"/g, '\\"')}"
goal_id: ${task.goalId ? `"${task.goalId}"` : 'null'}
is_completed: ${task.isCompleted}
is_daily: ${task.isDaily}
is_archived: ${task.isArchived || false}
estimated_minutes: ${task.estimatedMinutes || 30}
actual_minutes: ${task.actualMinutes || 'null'}
created_at: "${task.createdAt}"
completed_at: ${task.completedAt ? `"${task.completedAt}"` : 'null'}
metadata:
  source: "mto-app"
  synced_at: "${new Date().toISOString()}"
  folder: "${folder}"
---

# Task: ${task.title}

${task.description || '*No description*'}

## Status
${task.isCompleted ? '✅ Completed' : '⏳ Pending'}

## Time
- Estimated: ${task.estimatedMinutes || 30} minutes
${task.actualMinutes ? `- Actual: ${task.actualMinutes} minutes` : ''}

${task.goalId ? `## Linked Goal\nGoal ID: \`${task.goalId}\`` : '## Standalone Task'}
`;
}

/**
 * Convert SleepWakeLog to monthly markdown
 */
function sleepLogToMarkdown(logs: SleepWakeLog[], month: string): string {
  const entries = logs
    .filter(log => log.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(log => `
### ${log.date}
- **Woke up:** ${log.wakeUpTime || 'N/A'}
- **Mood:** ${log.wakeUpMood || 'N/A'}
- **Sleep time:** ${log.sleepTime || 'N/A'}
- **Duration:** ${log.sleepDurationMinutes ? `${Math.floor(log.sleepDurationMinutes / 60)}h ${log.sleepDurationMinutes % 60}m` : 'N/A'}
`).join('\n');

  return `---
schema_version: "${SCHEMA_VERSION}"
month: "${month}"
type: "sleep-log"
---

# Sleep Log - ${month}

## Daily Entries
${entries || '*No entries this month*'}
`;
}

/**
 * Convert DailyEntry to Obsidian markdown
 */
function diaryEntryToMarkdown(entry: DailyEntry, answers?: QuestionAnswer[], questions?: Question[]): string {
  const moodEmoji = entry.mood ? ['😢', '😕', '😐', '🙂', '😊'][entry.mood - 1] : '❓';
  const energyBar = entry.energyLevel 
    ? '█'.repeat(entry.energyLevel) + '░'.repeat(10 - entry.energyLevel)
    : 'N/A';

  const winsSection = entry.wins && entry.wins.length > 0
    ? `## 🏆 Wins\n${entry.wins.map(w => `- ${w}`).join('\n')}\n`
    : '';

  const challengesSection = entry.challenges && entry.challenges.length > 0
    ? `## ⚠️ Challenges\n${entry.challenges.map(c => `- ${c}`).join('\n')}\n`
    : '';

  const productivitySection = entry.productivityData && Object.keys(entry.productivityData).length > 0
    ? `## ⏱️ Productivity Time\n${Object.entries(entry.productivityData)
        .filter(([, v]) => v && v > 0)
        .map(([k, v]) => `- **${k.replace('_', ' ')}:** ${v} min`)
        .join('\n')}\n`
    : '';

  const qaSection = answers && answers.length > 0 && questions
    ? `## 💬 Reflections\n${answers.map(a => {
        const q = questions.find(q => q.id === a.questionId);
        return `### ${q?.questionText || 'Question'}\n${a.answer}\n`;
      }).join('\n')}\n`
    : '';

  return `---
schema_version: "${SCHEMA_VERSION}"
id: "${entry.id}"
date: "${entry.date}"
mood: ${entry.mood || 'null'}
energy_level: ${entry.energyLevel || 'null'}
metadata:
  source: "mto-diary"
  synced_at: "${new Date().toISOString()}"
---

# 📔 ${new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

## 📊 Daily Metrics
| Mood | Energy |
|------|--------|
| ${moodEmoji} ${entry.mood || 'N/A'}/5 | ${energyBar} ${entry.energyLevel || 'N/A'}/10 |

${entry.summary ? `## 📝 Summary\n${entry.summary}\n` : ''}
${winsSection}
${challengesSection}
${productivitySection}
${qaSection}
`;
}

// Helper to sanitize filenames
function sanitizeFilename(name: string): string {
  return (name || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
}

/**
 * Get goal folder path based on status
 */
function getGoalPath(goal: Goal): string {
  const folder = goal.status === 'completed' ? 'completed' 
    : goal.isArchived ? 'archive' : 'active';
  const cleanTitle = sanitizeFilename(goal.title);
  const shortId = goal.id.slice(0, 4);
  return `MTO/Goals/${folder}/${cleanTitle} (${shortId}).md`;
}

/**
 * Get task folder path
 */
function getTaskPath(task: Task): string {
  const folder = task.isCompleted ? 'completed' : 'active';
  const cleanTitle = sanitizeFilename(task.title);
  const shortId = task.id.slice(0, 4);
  return `MTO/Tasks/${folder}/${cleanTitle} (${shortId}).md`;
}

/**
 * Helper to call the sync API
 */
async function callSyncApi(
  path: string, 
  action: 'upsert' | 'delete', 
  content: string | null, 
  message: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/obsidian/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, action, content, message }),
    });
    
    if (!response.ok) {
      console.error('[Obsidian] API error:', response.status);
      return false;
    }
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('[Obsidian] Network error:', error);
    return false;
  }
}

/**
 * Sync a single goal to Obsidian
 */
export async function syncGoal(goal: Goal, action: 'upsert' | 'delete' = 'upsert'): Promise<boolean> {
  const path = getGoalPath(goal);
  const content = action === 'delete' ? null : goalToMarkdown(goal);
  const message = `[MTO] ${action === 'delete' ? 'Delete' : goal.status === 'completed' ? 'Complete' : 'Update'} goal: ${goal.title}`;

  return await callSyncApi(path, action, content, message);
}

/**
 * Sync a single task to Obsidian
 */
export async function syncTask(task: Task, action: 'upsert' | 'delete' = 'upsert'): Promise<boolean> {
  const path = getTaskPath(task);
  const content = action === 'delete' ? null : taskToMarkdown(task);
  const message = `[MTO] ${action === 'delete' ? 'Delete' : task.isCompleted ? 'Complete' : 'Update'} task: ${task.title}`;

  return await callSyncApi(path, action, content, message);
}

/**
 * Sync a diary entry to Obsidian
 */
export async function syncDiaryEntry(
  entry: DailyEntry,
  answers?: QuestionAnswer[],
  questions?: Question[],
  action: 'upsert' | 'delete' = 'upsert'
): Promise<boolean> {
  const [year, month, day] = entry.date.split('-');
  const path = `MTO/Diary/${year}/${month}/${day}/Diary.md`;
  const content = action === 'delete' ? null : diaryEntryToMarkdown(entry, answers, questions);
  const message = `[MTO] ${action === 'delete' ? 'Delete' : 'Sync'} diary: ${entry.date}`;

  return await callSyncApi(path, action, content, message);
}

/**
 * Queue a sync operation (non-blocking)
 */
export function queueSync(type: 'goal' | 'task', data: unknown, action: 'upsert' | 'delete' = 'upsert'): void {
  syncQueue.push({ type, data, action });
  syncStatus.pending = syncQueue.length;
  
  // Process queue if not already processing
  if (!isProcessingQueue) {
    processQueue();
  }
}

/**
 * Process sync queue with rate limiting
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || syncQueue.length === 0) return;
  
  isProcessingQueue = true;
  syncStatus.syncing = true;

  while (syncQueue.length > 0) {
    const item = syncQueue.shift();
    if (!item) continue;

    try {
      if (item.type === 'goal') {
        await syncGoal(item.data as Goal, item.action);
      } else if (item.type === 'task') {
        await syncTask(item.data as Task, item.action);
      }
    } catch (error) {
      console.error('[Obsidian] Sync error:', error);
      syncStatus.error = String(error);
    }

    syncStatus.pending = syncQueue.length;
    
    // Rate limiting to prevent flooding API
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  syncStatus.syncing = false;
  syncStatus.lastSync = new Date().toISOString();
  isProcessingQueue = false;
}

/**
 * Full sync of all data to Obsidian
 */
export async function fullSync(
  goals: Goal[],
  tasks: Task[],
  sleepLogs: SleepWakeLog[]
): Promise<SyncResult> {
  syncStatus.syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    // Check status first
    const statusRes = await fetch('/api/obsidian/status');
    const statusData = await statusRes.json();
    if (!statusData.configured) {
       return { success: false, synced: 0, failed: 0, error: 'GitHub not configured' };
    }

    // Sync all goals
    for (const goal of goals) {
      const success = await syncGoal(goal);
      if (success) synced++;
      else failed++;
    }

    // Sync all tasks
    for (const task of tasks) {
      const success = await syncTask(task);
      if (success) synced++;
      else failed++;
    }

    // Sync sleep logs by month
    const months = [...new Set(sleepLogs.map(log => log.date.substring(0, 7)))];
    for (const month of months) {
      const content = sleepLogToMarkdown(sleepLogs, month);
      const [year, monthNum] = month.split('-');
      const path = `MTO/Sleep/${year}/${monthNum}.md`;
      const success = await callSyncApi(path, 'upsert', content, `[MTO] Sync sleep log: ${month}`);
      
      if (success) synced++;
      else failed++;
    }

    syncStatus.lastSync = new Date().toISOString();
    syncStatus.error = null;

    return { success: true, synced, failed };
  } catch (error) {
    syncStatus.error = String(error);
    return { success: false, synced, failed, error: String(error) };
  } finally {
    syncStatus.syncing = false;
  }
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
    case 1: return '🟢 Low';
    case 2: return '🟡 Normal';
    case 3: return '🔴 Critical';
    default: return '🟡 Normal';
  }
}
