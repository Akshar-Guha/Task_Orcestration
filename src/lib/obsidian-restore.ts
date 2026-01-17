/**
 * Obsidian Restore Service
 * 
 * Restores data from Obsidian vault to Supabase.
 * Parses markdown files and converts them back to app data.
 */

import { github } from './github';
import type { Goal, Task, SleepWakeLog } from './types';

interface ParsedFrontmatter {
  [key: string]: unknown;
}

interface RestoreResult {
  success: boolean;
  restored: { goals: number; tasks: number; sleepLogs: number };
  errors: string[];
}

/**
 * Parse YAML frontmatter from markdown
 */
function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: ParsedFrontmatter = {};

  // Simple YAML parser (handles basic key: value and arrays)
  const lines = yaml.split('\n');
  let currentKey = '';
  
  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check for array item
    if (line.startsWith('  - ')) {
      if (currentKey && Array.isArray(result[currentKey])) {
        (result[currentKey] as unknown[]).push(line.substring(4).trim().replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // Parse key: value
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    let value: unknown = line.substring(colonIndex + 1).trim();

    // Remove quotes
    if (typeof value === 'string') {
      value = value.replace(/^["']|["']$/g, '');
    }

    // Parse special values
    if (value === 'null' || value === '') value = null;
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
    else if (value === '[]') value = [];
    else if ((value as string).startsWith('[')) {
      try {
        value = JSON.parse(value as string);
      } catch {
        // Keep as string
      }
    }

    result[key] = value;
    currentKey = key;
  }

  return result;
}

/**
 * Parse Goal from Obsidian markdown
 */
function parseGoal(content: string, filePath: string): Goal | null {
  try {
    const frontmatter = parseFrontmatter(content);
    
    if (!frontmatter.id || !frontmatter.title) {
      console.warn('[Restore] Invalid goal file:', filePath);
      return null;
    }

    // Determine status from folder structure
    let status = frontmatter.status as string || 'not_started';
    let isArchived = frontmatter.is_archived as boolean || false;
    
    if (filePath.includes('/completed/')) {
      status = 'completed';
    } else if (filePath.includes('/archive/')) {
      isArchived = true;
    }

    return {
      id: frontmatter.id as string,
      title: frontmatter.title as string,
      description: frontmatter.description as string | undefined,
      level: (frontmatter.level as Goal['level']) || 'primary',
      status: status as Goal['status'],
      priority: (frontmatter.priority as 1 | 2 | 3) || 2,
      dependsOn: (frontmatter.depends_on as string[]) || [],
      unlocks: (frontmatter.unlocks as string[]) || [],
      timeSlotId: frontmatter.time_slot_id as string | undefined,
      isArchived,
      createdAt: frontmatter.created_at as string || new Date().toISOString(),
      startedAt: frontmatter.started_at as string | undefined,
      completedAt: frontmatter.completed_at as string | undefined,
    };
  } catch (error) {
    console.error('[Restore] Failed to parse goal:', filePath, error);
    return null;
  }
}

/**
 * Parse Task from Obsidian markdown
 */
function parseTask(content: string, filePath: string): Task | null {
  try {
    const frontmatter = parseFrontmatter(content);
    
    if (!frontmatter.id || !frontmatter.title) {
      console.warn('[Restore] Invalid task file:', filePath);
      return null;
    }

    // Determine completion from folder
    let isCompleted = frontmatter.is_completed as boolean || false;
    if (filePath.includes('/completed/')) {
      isCompleted = true;
    }

    return {
      id: frontmatter.id as string,
      title: frontmatter.title as string,
      description: frontmatter.description as string | undefined,
      goalId: frontmatter.goal_id as string | undefined,
      isCompleted,
      isDaily: frontmatter.is_daily as boolean || false,
      isArchived: frontmatter.is_archived as boolean || false,
      estimatedMinutes: frontmatter.estimated_minutes as number || 30,
      actualMinutes: frontmatter.actual_minutes as number | undefined,
      createdAt: frontmatter.created_at as string || new Date().toISOString(),
      completedAt: frontmatter.completed_at as string | undefined,
    };
  } catch (error) {
    console.error('[Restore] Failed to parse task:', filePath, error);
    return null;
  }
}

/**
 * List all goal files from Obsidian
 */
async function listGoalFiles(): Promise<string[]> {
  const folders = ['goals/active', 'goals/completed', 'goals/archive'];
  const allFiles: string[] = [];

  for (const folder of folders) {
    const files = await github.listFiles(folder);
    allFiles.push(...files.filter(f => f.endsWith('.md') && !f.includes('_schema')));
  }

  return allFiles;
}

/**
 * List all task files from Obsidian
 */
async function listTaskFiles(): Promise<string[]> {
  const folders = ['tasks/active', 'tasks/completed'];
  const allFiles: string[] = [];

  for (const folder of folders) {
    const files = await github.listFiles(folder);
    allFiles.push(...files.filter(f => f.endsWith('.md') && !f.includes('_schema')));
  }

  return allFiles;
}

/**
 * Restore all goals from Obsidian
 */
export async function restoreGoals(): Promise<{ goals: Goal[]; errors: string[] }> {
  const goals: Goal[] = [];
  const errors: string[] = [];

  if (!github.isConfigured()) {
    return { goals, errors: ['GitHub not configured'] };
  }

  try {
    const files = await listGoalFiles();
    
    for (const filePath of files) {
      const file = await github.getFile(filePath);
      if (!file) continue;

      const goal = parseGoal(file.content, filePath);
      if (goal) {
        goals.push(goal);
      } else {
        errors.push(`Failed to parse: ${filePath}`);
      }
    }
  } catch (error) {
    errors.push(`Error listing goals: ${error}`);
  }

  return { goals, errors };
}

/**
 * Restore all tasks from Obsidian
 */
export async function restoreTasks(): Promise<{ tasks: Task[]; errors: string[] }> {
  const tasks: Task[] = [];
  const errors: string[] = [];

  if (!github.isConfigured()) {
    return { tasks, errors: ['GitHub not configured'] };
  }

  try {
    const files = await listTaskFiles();
    
    for (const filePath of files) {
      const file = await github.getFile(filePath);
      if (!file) continue;

      const task = parseTask(file.content, filePath);
      if (task) {
        tasks.push(task);
      } else {
        errors.push(`Failed to parse: ${filePath}`);
      }
    }
  } catch (error) {
    errors.push(`Error listing tasks: ${error}`);
  }

  return { tasks, errors };
}

/**
 * Full restore from Obsidian to Supabase
 */
export async function fullRestore(): Promise<RestoreResult> {
  const errors: string[] = [];
  const restored = { goals: 0, tasks: 0, sleepLogs: 0 };

  if (!github.isConfigured()) {
    return { 
      success: false, 
      restored, 
      errors: ['GitHub not configured. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in environment.'] 
    };
  }

  try {
    // Restore goals
    const { goals, errors: goalErrors } = await restoreGoals();
    restored.goals = goals.length;
    errors.push(...goalErrors);

    // Restore tasks
    const { tasks, errors: taskErrors } = await restoreTasks();
    restored.tasks = tasks.length;
    errors.push(...taskErrors);

    // TODO: Restore sleep logs when needed

    return {
      success: errors.length === 0,
      restored,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      restored,
      errors: [`Restore failed: ${error}`],
    };
  }
}

/**
 * Check if Obsidian backup exists
 */
export async function hasBackup(): Promise<boolean> {
  if (!github.isConfigured()) return false;

  try {
    const goalFiles = await github.listFiles('goals/active');
    return goalFiles.length > 0;
  } catch {
    return false;
  }
}
