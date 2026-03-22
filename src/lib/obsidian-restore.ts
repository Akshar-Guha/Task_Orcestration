/**
 * Obsidian Restore Service
 * 
 * Restores data from Obsidian vault to Supabase.
 * Parses markdown files and converts them back to app data.
 */

import { github } from './github';
import type { Goal, Task } from './types';

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
      level: (frontmatter.level as Goal['level']) || 'uncategorized',
      metadata: (frontmatter.metadata as Goal['metadata']) || { type: 'uncategorized' as const },
      status: status as Goal['status'],
      priority: (frontmatter.priority as 1 | 2 | 3) || 2,
      dependsOn: (frontmatter.depends_on as string[]) || [],
      unlocks: (frontmatter.unlocks as string[]) || [],
      timeSlotId: frontmatter.time_slot_id as string | undefined,
      isArchived,
      // full-sync writes 'created', 'started', 'completed' (no _at suffix)
      createdAt: (frontmatter.created_at ?? frontmatter.created) as string || new Date().toISOString(),
      startedAt: (frontmatter.started_at ?? frontmatter.started) as string | undefined,
      completedAt: (frontmatter.completed_at ?? frontmatter.completed) as string | undefined,
    };
  } catch (error) {
    console.error('[Restore] Failed to parse goal:', filePath, error);
    return null;
  }
}


/**
 * List all goal files from Obsidian (current vault structure: MTO/Goals/)
 */
async function listGoalFiles(): Promise<string[]> {
  const files = await github.listFiles('MTO/Goals');
  return files.filter(f => f.endsWith('.md'));
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
 * Tasks are embedded inside goal files (MTO/Goals/) — not individual files.
 * Full task restore requires reading from Supabase directly.
 */
export async function restoreTasks(): Promise<{ tasks: Task[]; errors: string[] }> {
  return { tasks: [], errors: ['Tasks are embedded in goal files. Restore from Supabase instead.'] };
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
    const goalFiles = await github.listFiles('MTO/Goals');
    return goalFiles.length > 0;
  } catch {
    return false;
  }
}
