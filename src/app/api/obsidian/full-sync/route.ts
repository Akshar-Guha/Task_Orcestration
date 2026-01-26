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
    const { data: historyEvents } = await supabase
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

    // Fetch Sleep Logs
    const { data: sleepLogs } = await supabase
        .from('sleep_wake_logs')
        .select('*')
        .eq('user_id', userId);

    const sleepByDate = new Map<string, any>();
    if (sleepLogs) {
        sleepLogs.forEach(log => sleepByDate.set(log.date, log));
    }

    // Fetch Daily Entries (Diary)
    const { data: diaryEntries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', userId);

    const diaryByDate = new Map<string, any>();
    if (diaryEntries) {
        diaryEntries.forEach(entry => diaryByDate.set(entry.date, entry));
    }

    // Get All Unique Dates
    const allDates = new Set<string>([
        ...historyByDate.keys(),
        ...sleepByDate.keys(),
        ...diaryByDate.keys()
    ]);

    // Generate Daily Notes for ALL Dates
    for (const date of allDates) {
         try {
             const [year, month, day] = date.split('-');
             const path = `MTO/Diary/${year}/${month}/${day}/Diary.md`;

             const entry = diaryByDate.get(date);
             const sleep = sleepByDate.get(date);
             const dayEvents = historyByDate.get(date) || [];

             // Completed Tasks Section
             const completedTaskLines = dayEvents.map((evt:any) => {
                 const task = taskMap.get(evt.task_id);
                 const title = task ? task.title : 'Unknown Task';
                 const time = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                 return `- [x] ${title} (${time})`;
             }).join('\n');
             const completedSection = completedTaskLines ? `\n## ✅ Completed Tasks\n${completedTaskLines}\n` : '';

             // Sleep Section
             let sleepSection = '';
             if (sleep) {
                const duration = sleep.sleep_duration_minutes 
                    ? `${Math.floor(sleep.sleep_duration_minutes / 60)}h ${sleep.sleep_duration_minutes % 60}m` 
                    : 'N/A';
                const moodMap: Record<number, string> = { 5: '🤩', 4: '🙂', 3: '😐', 2: '😫', 1: '💀' };
                sleepSection = `
## 😴 Sleep & Recovery
- **Sleep:** ${sleep.sleep_time || 'N/A'}
- **Wake:** ${sleep.wake_up_time || 'N/A'}
- **Duration:** ${duration}
- **Mood:** ${moodMap[sleep.wake_up_mood] || '❓'}
`;
             }

             // Diary Details check
             let diaryDetails = '';
             if (entry) {
                 diaryDetails = await formatDiaryDetails(entry.id, supabase);
             }

             // Construct Content
             const content = `---
date: "${date}"
type: "daily_note"
mood: ${entry?.mood || 'null'}
energy: ${entry?.energy_level || 'null'}
synced_at: "${new Date().toISOString()}"
---

# 📔 ${new Date(date).toDateString()}

${entry ? `## Mood: ${entry.mood}/5 | Energy: ${entry.energy_level || 'N/A'}/10` : ''}

${sleepSection}

${entry?.summary ? `## Summary\n${entry.summary}` : ''}

${completedSection}

${diaryDetails}
`;
             await github.upsertFile(
                 { path, content },
                 `[MTO] Sync daily note: ${date}`
             );
             
             // SNAPSHOT: Save Daily Tasks as individual files (Still logic)
             for (const evt of dayEvents) {
                const task = taskMap.get(evt.task_id);
                if (task) {
                    const cleanTitle = (task.title || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
                    const taskPath = `MTO/Diary/${year}/${month}/${day}/${cleanTitle}.md`;
                    const taskContent = `---
id: "${task.id}"
task_id: "${task.id}"
date: "${date}"
completed_at: "${evt.timestamp}"
type: "daily_snapshot"
---
# ${task.title}

**Completed at:** ${new Date(evt.timestamp).toLocaleTimeString()}

${task.description || ''}
`;
                    await github.upsertFile(
                        { path: taskPath, content: taskContent },
                        `[MTO] Snapshot task: ${task.title}`
                    );
                }
             }
         } catch (e) {
             console.error(`Daily Note sync error for ${date}`, e);
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
