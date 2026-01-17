/**
 * Full Obsidian Sync API
 * 
 * Syncs ALL goals and tasks from Supabase to Obsidian.
 * Used for manual sync trigger from the settings page.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { github } from '@/lib/github';

const FALLBACK_USER_ID = '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

function goalToMarkdown(goal: Record<string, unknown>): string {
  return `---
id: "${goal.id}"
title: "${goal.title}"
level: "${goal.level}"
status: "${goal.status}"
priority: ${goal.priority || 2}
is_archived: ${goal.is_archived || false}
created_at: "${goal.created_at}"
synced_at: "${new Date().toISOString()}"
---

# ${goal.title}

${goal.description || '*No description*'}

## Status
${goal.status?.toString().replace('_', ' ')}
`;
}

function taskToMarkdown(task: Record<string, unknown>): string {
  return `---
id: "${task.id}"
title: "${task.title}"
goal_id: ${task.goal_id ? `"${task.goal_id}"` : 'null'}
is_completed: ${task.is_completed || false}
is_daily: ${task.is_daily || false}
created_at: "${task.created_at}"
synced_at: "${new Date().toISOString()}"
---

# ${task.title}

${task.description || '*No description*'}

## Status
${task.is_completed ? '✅ Completed' : '⏳ Pending'}
`;
}

export async function POST() {
  const results = {
    goals: { synced: 0, failed: 0, errors: [] as string[] },
    tasks: { synced: 0, failed: 0, errors: [] as string[] },
  };

  try {
    if (!github.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'GitHub not configured. Add GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO to environment.',
      }, { status: 503 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || FALLBACK_USER_ID;

    // Fetch all goals
    const { data: goals, error: goalsErr } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId);

    if (goalsErr) {
      results.goals.errors.push(goalsErr.message);
    } else if (goals) {
      for (const goal of goals) {
        try {
          const statusFolder = goal.status === 'completed' ? 'completed' 
            : goal.is_archived ? 'archive' : 'active';
          const path = `MTO/Goals/${statusFolder}/${goal.id}.md`;
          
          await github.upsertFile(
            { path, content: goalToMarkdown(goal) },
            `[MTO] Sync goal: ${goal.title}`
          );
          results.goals.synced++;
        } catch (e) {
          results.goals.failed++;
          results.goals.errors.push(`Goal ${goal.title}: ${String(e)}`);
        }
      }
    }

    // Fetch all tasks
    const { data: tasks, error: tasksErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (tasksErr) {
      results.tasks.errors.push(tasksErr.message);
    } else if (tasks) {
      for (const task of tasks) {
        try {
          const statusFolder = task.is_completed ? 'completed' : 'active';
          const path = `MTO/Tasks/${statusFolder}/${task.id}.md`;
          
          await github.upsertFile(
            { path, content: taskToMarkdown(task) },
            `[MTO] Sync task: ${task.title}`
          );
          results.tasks.synced++;
        } catch (e) {
          results.tasks.failed++;
          results.tasks.errors.push(`Task ${task.title}: ${String(e)}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      results,
    }, { status: 500 });
  }
}
