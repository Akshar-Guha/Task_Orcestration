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
          // Readable filename
          const cleanTitle = (goal.title || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
          const shortId = goal.id.slice(0, 4);
          const path = `MTO/Goals/${statusFolder}/${cleanTitle} (${shortId}).md`;
          
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
          // Readable filename
          const cleanTitle = (task.title || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
          const shortId = task.id.slice(0, 4);
          const path = `MTO/Tasks/${statusFolder}/${cleanTitle} (${shortId}).md`;
          
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

    // Create Task Map for history lookup
    const taskMap = new Map<string, any>();
    if (tasks) {
        tasks.forEach(t => taskMap.set(t.id, t));
    }

    // Fetch Task Completion History (Timeline Events)
    const { data: historyEvents, error: historyErr } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', 'task_completed');

    const historyByDate = new Map<string, any[]>();
    if (historyEvents) {
        historyEvents.forEach(evt => {
            const date = evt.timestamp.split('T')[0];
            if (!historyByDate.has(date)) historyByDate.set(date, []);
            historyByDate.get(date)?.push(evt);
        });
    }

    // Fetch and sync Daily Entries (Diary)
    const { data: diaryEntries, error: diaryErr } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', userId);
        
    if (!diaryErr && diaryEntries) {
        for (const entry of diaryEntries) {
             try {
                 // Nested folder structure: MTO/Diary/YYYY/MM/DD/Diary.md
                 // User wants "nested date wise folder for each date data"
                 // So we create a folder for the day
                 const [year, month, day] = entry.date.split('-');
                 const path = `MTO/Diary/${year}/${month}/${day}/Diary.md`;
                 
                 // Get completed tasks for this date
                 const dayEvents = historyByDate.get(entry.date) || [];
                 const completedTaskLines = dayEvents.map(evt => {
                     const task = taskMap.get(evt.task_id);
                     const title = task ? task.title : 'Unknown Task';
                     const time = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                     return `- [x] ${title} (${time})`;
                 }).join('\n');

                 const completedSection = completedTaskLines ? `\n## ✅ Completed Tasks\n${completedTaskLines}\n` : '';

                 const content = `---
id: "${entry.id}"
date: "${entry.date}"
mood: ${entry.mood}
energy: ${entry.energy_level}
synced_at: "${new Date().toISOString()}"
---

# 📔 ${new Date(entry.date).toDateString()}

## Mood: ${entry.mood}/5 | Energy: ${entry.energy_level || 'N/A'}/10

${entry.summary ? `## Summary\n${entry.summary}` : ''}

${completedSection}

${await formatDiaryDetails(entry.id, supabase)}
`;
                 await github.upsertFile(
                     { path, content },
                     `[MTO] Sync diary: ${entry.date}`
                 );
             } catch (e) {
                 console.error("Diary sync error", e);
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

// Helper to fetch details for diary
async function formatDiaryDetails(entryId: string, supabaseClient: any) {
    // Fetch answers
    const { data: answers } = await supabaseClient.from('diary_answers').select('*, questions(question_text)').eq('entry_id', entryId);
    if (!answers?.length) return '';
    
    return `## Reflections\n` + answers.map((a: any) => `### ${a.questions?.question_text || 'Question'}\n${a.answer}\n`).join('\n');
}
