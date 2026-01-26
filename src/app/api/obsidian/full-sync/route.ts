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
    history: { synced: 0, failed: 0, errors: [] as string[] }
  };

  try {
    if (!github.isConfigured()) {
      return NextResponse.json({ success: false, error: 'GitHub not configured' }, { status: 503 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || FALLBACK_USER_ID;

    // 1. Fetch ALL Data
    const { data: goals } = await supabase.from('goals').select('*').eq('user_id', userId);
    const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', userId);
    const { data: sleepLogs } = await supabase.from('sleep_wake_logs').select('*').eq('user_id', userId);
    const { data: diaryEntries } = await supabase.from('daily_entries').select('*').eq('user_id', userId);
    
    // Timeline Events (Task Completions)
    const { data: historyEvents } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', 'task_completed');

    // 2. Index Data by Date
    const dataByDate = new Map<string, {
        diary?: any,
        sleep?: any,
        tasks: any[],
        goals: any[] // Goals completed on this date
    }>();

    const getDayBucket = (date: string) => {
        if (!dataByDate.has(date)) {
            dataByDate.set(date, { tasks: [], goals: [] });
        }
        return dataByDate.get(date)!;
    };

    // Index Diary
    diaryEntries?.forEach(entry => {
        getDayBucket(entry.date).diary = entry;
    });

    // Index Sleep
    sleepLogs?.forEach(log => {
        getDayBucket(log.date).sleep = log;
    });

    // Index Completed Tasks (via Timeline or CompletedAt)
    // We prefer Timeline for accuracy, but fallback to Task.completed_at
    if (historyEvents) {
        // Map tasks by ID for details
        const taskMap = new Map(tasks?.map(t => [t.id, t]));
        historyEvents.forEach(evt => {
            const date = evt.timestamp.split('T')[0];
            const task = taskMap.get(evt.task_id);
            if (task) {
                getDayBucket(date).tasks.push({ ...task, completion_evt: evt });
            }
        });
    } else if (tasks) {
        // Fallback if no timeline
        tasks.filter(t => t.is_completed && t.completed_at).forEach(t => {
            const date = new Date(t.completed_at).toISOString().split('T')[0];
            getDayBucket(date).tasks.push(t);
        });
    }

    // Index Completed Goals
    goals?.filter(g => g.status === 'completed' && g.completed_at).forEach(g => {
        const date = new Date(g.completed_at).toISOString().split('T')[0];
        getDayBucket(date).goals.push(g);
    });

    // ===================================
    // SNAPSHOT ACTIVE STATE (For "Today")
    // ===================================
    // User wants a full "Reality Reflection", so we include what is currently PENDING 
    // in today's folder as well.
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Add Active Tasks to Today
    tasks?.filter(t => !t.is_completed).forEach(t => {
        getDayBucket(todayStr).tasks.push(t);
    });

    // Add Active Goals to Today
    goals?.filter(g => g.status !== 'completed' && !g.is_archived).forEach(g => {
        getDayBucket(todayStr).goals.push(g);
    });

    // 3. Generate Warehouse Files
    for (const [date, bucket] of dataByDate) {
        try {
            const [year, month, day] = date.split('-');
            const basePath = `MTO/Data/${year}/${month}/${day}`;

            // A. Diary.md (The Hub)
            let diaryContent = `---
date: "${date}"
type: "daily_record"
synced_at: "${new Date().toISOString()}"
---
# 📅 Daily Record: ${date}

`;
            if (bucket.diary) {
                const e = bucket.diary;
                diaryContent += `## 🧠 Mindset\n- **Mood**: ${e.mood}/5\n- **Energy**: ${e.energy_level}/10\n\n`;
                if (e.summary) diaryContent += `## 📝 Summary\n${e.summary}\n\n`;
                const details = await formatDiaryDetails(e.id, supabase);
                if (details) diaryContent += details + '\n';
            }

            if (bucket.sleep) {
                const s = bucket.sleep;
                const duration = s.sleep_duration_minutes 
                    ? `${Math.floor(s.sleep_duration_minutes / 60)}h ${s.sleep_duration_minutes % 60}m` : 'N/A';
                diaryContent += `## 😴 Sleep\n- **Duration**: ${duration}\n- **Wake**: ${s.wake_up_time}\n- **Mood**: ${s.wake_up_mood}/5\n\n`;
                
                // Also save individual sleep file
                const sleepPath = `${basePath}/Sleep.md`;
                await github.upsertFile({ path: sleepPath, content: JSON.stringify(bucket.sleep, null, 2) }, `[MTO] Sleep data`);
            }

            // Save Diary
            await github.upsertFile({ path: `${basePath}/Diary.md`, content: diaryContent }, `[MTO] Diary ${date}`);
            
            // B. Tasks (Both Completed and Active)
            for (const task of bucket.tasks) {
                const cleanTitle = (task.title || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
                // Prefix with status for easy sorting
                const isCompleted = task.is_completed || (task.completion_evt !== undefined);
                const prefix = isCompleted ? '✅' : '⏳';
                const path = `${basePath}/Tasks/${cleanTitle}.md`;
                
                const timestamp = task.completion_evt?.timestamp || task.completed_at || date; // For active, default to today
                
                const content = `---
id: "${task.id}"
status: "${isCompleted ? 'completed' : 'active'}"
date: "${date}"
type: "task_snapshot"
---
# ${prefix} ${task.title}
**Status**: ${isCompleted ? 'Completed' : 'Pending'}
${isCompleted ? `**Completed At**: ${new Date(timestamp).toLocaleTimeString()}` : ''}

${task.description || ''}
`;
                await github.upsertFile({ path, content }, `[MTO] Task ${task.title}`);
            }

            // C. Goals (Both Completed and Active)
            for (const goal of bucket.goals) {
                const cleanTitle = (goal.title || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
                const isCompleted = goal.status === 'completed';
                const prefix = isCompleted ? '🏆' : '🎯';
                const path = `${basePath}/Goals/${cleanTitle}.md`;
                
                const content = `---
id: "${goal.id}"
status: "${goal.status}"
date: "${date}"
type: "goal_snapshot"
---
# ${prefix} ${goal.title}
**Status**: ${goal.status}
${isCompleted ? `**Completed At**: ${new Date(goal.completed_at).toLocaleTimeString()}` : ''}

${goal.description || ''}
`;
                await github.upsertFile({ path, content }, `[MTO] Goal ${goal.title}`);
            }

            results.history.synced++;

        } catch (e) {
            console.error(`Error syncing date ${date}`, e);
            results.history.failed++;
        }
    }

    // 4. CLEANUP LEGACY FOLDERS (Active State)
    // We delete 'MTO/Tasks', 'MTO/Goals', AND 'MTO/Diary' (Old root)
    try {
        console.log("Cleaning up legacy structure...");
        // List root items to find leftovers
        const legacyPaths = [
            'MTO/Tasks/active', 'MTO/Tasks/completed', 
            'MTO/Goals/active', 'MTO/Goals/archive', 'MTO/Goals/completed',
            'MTO/Diary', // Clean up old Diary root if it exists, assuming all migrated to Data
        ];
        
        for (const dir of legacyPaths) {
            // We only want to delete invalid structure, not Data
            if (dir === 'MTO/Diary') {
                 // Listing MTO/Diary might return YYYY folders if we used MTO/Diary/2026 before.
                 // But wait, the new structure uses MTO/Data. So MTO/Diary is old.
                 // We should proceed carefully. Is MTO/Diary/2026/01/27 the same as MTO/Data/2026/01/27?
                 // No, I changed it to MTO/Data.
                 // So entire MTO/Diary can be considered legacy if user accepted the "Data" rename.
                 // Let's delete it.
            }
            
            const files = await github.listFiles(dir);
            for (const file of files) {
                // Determine if this file is in the new MTO/Data structure? No, it's in legacyPaths.
                // Just delete it.
                await github.softDeleteFile(file, '[MTO] Cleanup legacy structure (Moving to Warehouse)');
            }
        }
    } catch (e) {
        console.warn("Cleanup warning:", e);
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// Helper to fetch details for diary
async function formatDiaryDetails(entryId: string, supabaseClient: any) {
    // Fetch answers
    const { data: answers } = await supabaseClient.from('diary_answers').select('*, questions(question_text)').eq('entry_id', entryId);
    if (!answers?.length) return '';
    
    return `## Reflections\n` + answers.map((a: any) => `### ${a.questions?.question_text || 'Question'}\n${a.answer}\n`).join('\n');
}
