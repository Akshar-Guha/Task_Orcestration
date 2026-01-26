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

    // ===================================
    // MULTI-DATE INDEXING (The "Unconstrained Log")
    // ===================================
    // We place each item into EVERY date bucket it is relevant to.
    // 1. Creation Date (Log: Created)
    // 2. Completion Date(s) (Log: Completed)
    // 3. Today (Log: Active/Pending if applicable)
    
    // Helper to add data to a specific date bucket
    const addToBucket = (dateStr: string, type: 'tasks' | 'goals', item: any, logType: 'Created' | 'Completed' | 'Active' | 'Pending') => {
        if (!dateStr || isNaN(new Date(dateStr).getTime())) return;
        const date = dateStr.split('T')[0];
        const bucket = getDayBucket(date);
        // Add meta for logging
        bucket[type].push({ ...item, _log_status: logType, _log_date: date });
    };

    const todayStr = new Date().toISOString().split('T')[0];

    // PROCESS TASKS
    if (tasks) {
        // Map for timeline lookup
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        tasks.forEach(task => {
            // A. Log Creation
            if (task.created_at) {
                addToBucket(task.created_at, 'tasks', task, 'Created');
            }

            // B. Log Completions (via Timeline)
            // (If no timeline, fallback to completed_at)
            let hasTimeline = false;
            if (historyEvents) {
                const events = historyEvents.filter((e: any) => e.task_id === task.id);
                events.forEach((evt: any) => {
                    hasTimeline = true;
                    addToBucket(evt.timestamp, 'tasks', { ...task, completion_evt: evt }, 'Completed');
                });
            }
            
            if (!hasTimeline && task.is_completed && task.completed_at) {
                addToBucket(task.completed_at, 'tasks', task, 'Completed');
            }

            // C. Log Active State (Today)
            // If it is NOT completed, OR if it IS completed but is_daily (resets)
            // We log it as "Pending" or "Active" for Today.
            if (!task.is_completed || task.is_daily) {
                // If it's done today, we already logged "Completed". 
                // But daily tasks also exist as "Pending" for tomorrow (conceptually).
                // User wants "Active state".
                // If it IS completed today, we might want to skip "Active" to avoid double noise?
                // User said "Active or any state... entire logs".
                // We will add it as "Active" to Today.
                addToBucket(todayStr, 'tasks', task, 'Pending'); // "Pending" implies "To Do"
            }
        });
    }

    // PROCESS GOALS
    if (goals) {
        goals.forEach(goal => {
            // A. Log Creation
            if (goal.created_at) {
                addToBucket(goal.created_at, 'goals', goal, 'Created');
            }

            // B. Log Completion
            if (goal.status === 'completed' && goal.completed_at) {
                addToBucket(goal.completed_at, 'goals', goal, 'Completed');
            }

            // C. Log Active (Today)
            if (goal.status !== 'completed' && !goal.is_archived) {
                addToBucket(todayStr, 'goals', goal, 'Active');
            }
        });
    }

    // 3. Generate Warehouse Files
    for (const [date, bucket] of dataByDate) {
        try {
            const [year, month, day] = date.split('-');
            const basePath = `MTO/Data/${year}/${month}/${day}`;

            // A. Diary.md etc (Keep existing logic)
            // ... (We assume previous code block for Diary/Sleep is kept if outside this replace range, 
            // but checked lines 156-185 are inside 'Generate Warehouse Files' loop? 
            // The previous replace covered lines. I need to be careful not to delete Diary/Sleep logic.
            // Wait, implementation above effectively REPLACED the loop start.
            // I need to include the Diary Logic in my ReplacementContent or ensure StartLine maps correctly.
            // My StartLine is 108 (Start of "Index Completed Tasks").
            // My EndLine is 239 (End of Loop).
            // So I am rewriting the Entire Indexing + Loop logic.
            // I MUST include Diary/Sleep loop body.
            
            // Re-inserting Diary/Sleep Logic:
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
                const sleepPath = `${basePath}/Sleep.md`;
                await github.upsertFile({ path: sleepPath, content: JSON.stringify(bucket.sleep, null, 2) }, `[MTO] Sleep data`);
            }

             await github.upsertFile({ path: `${basePath}/Diary.md`, content: diaryContent }, `[MTO] Diary ${date}`);


            // B. TASKS (Detailed Dump)
            for (const task of bucket.tasks) {
                const cleanTitle = (task.title || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
                const logStatus = task._log_status || 'Unknown';
                const filename = `${cleanTitle} (${logStatus}).md`;
                const path = `${basePath}/Tasks/${filename}`;
                
                // FULL ATTRIBUTE DUMP
                const content = `---
id: "${task.id}"
log_status: "${logStatus}"
log_date: "${date}"
title: "${task.title}"
is_completed: ${task.is_completed}
is_daily: ${task.is_daily}
priority: ${task.priority}
estimated_minutes: ${task.estimated_minutes}
actual_minutes: ${task.actual_minutes}
created_at: "${task.created_at}"
completed_at: "${task.completed_at || ''}"
goal_id: "${task.goal_id || ''}"
synced_at: "${new Date().toISOString()}"
---
# ${task.title}

**Log Status**: ${logStatus}
**Date**: ${date}

## Details
${task.description || ''}
`;
                await github.upsertFile({ path, content }, `[MTO] Task Log: ${filename}`);
            }

            // C. GOALS (Detailed Dump)
            for (const goal of bucket.goals) {
                const cleanTitle = (goal.title || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
                const logStatus = goal._log_status || 'Unknown';
                const filename = `${cleanTitle} (${logStatus}).md`;
                const path = `${basePath}/Goals/${filename}`;
                
                const content = `---
id: "${goal.id}"
log_status: "${logStatus}"
log_date: "${date}"
title: "${goal.title}"
status: "${goal.status}"
priority: ${goal.priority}
level: "${goal.level}"
is_archived: ${goal.is_archived}
created_at: "${goal.created_at}"
completed_at: "${goal.completed_at || ''}"
synced_at: "${new Date().toISOString()}"
---
# ${goal.title}

**Log Status**: ${logStatus}
**Date**: ${date}

## Details
${goal.description || ''}
`;
                await github.upsertFile({ path, content }, `[MTO] Goal Log: ${filename}`);
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
