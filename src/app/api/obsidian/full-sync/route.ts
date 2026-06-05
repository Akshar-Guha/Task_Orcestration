/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Full Obsidian Sync API — Time-Series Data Warehouse
 *
 * Vault structure:
 *   MTO/Goals/{slug}.md         — 1 file per goal, always current state
 *   MTO/Daily/{date}.md         — 1 file per day from daily_entries (immutable once written)
 *   MTO/Sleep/{year}-{month}.md — monthly sleep log
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { github } from '@/lib/github';

// Fix: use service-role client for full data access in server-side sync
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? '';

function slugify(title: string): string {
  return (title || 'Untitled').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-');
}

function goalToMarkdown(goal: any, goalTasks: any[]): string {
  const taskLines = goalTasks.length > 0
    ? goalTasks.map((t: any) => `- ${t.title} (${t.estimated_minutes}min/day)`).join('\n')
    : '*No tasks*';

  return `---
id: "${goal.id}"
title: "${goal.title}"
level: "${goal.level}"
status: "${goal.status}"
priority: ${goal.priority || 2}
is_archived: ${goal.is_archived || false}
created_at: "${goal.created_at}"
started_at: ${goal.started_at ? `"${goal.started_at}"` : 'null'}
completed_at: ${goal.completed_at ? `"${goal.completed_at}"` : 'null'}
synced_at: "${new Date().toISOString()}"
---

# ${goal.title}

${goal.description || '*No description*'}

## Daily Tasks
${taskLines}
`;
}

function dailyToMarkdown(
  entry: any,
  completedTasks: any[],
  allDailyTasks: any[],
  sleep: any | null
): string {
  const date = entry.date as string;

  const completedIds = new Set(completedTasks.map((t: any) => t.task_id));

  const taskLines = allDailyTasks.map((t: any) => {
    const done = completedIds.has(t.id);
    const completion = completedTasks.find((c: any) => c.task_id === t.id);
    const minStr = completion?.minutes_spent ? ` (${completion.minutes_spent}min)` : '';
    const goalName = t.goal_title ? ` — ${t.goal_title}` : '';
    return `- [${done ? 'x' : ' '}] ${t.title}${minStr}${goalName}`;
  }).join('\n') || '*No tasks defined*';

  const wins = Array.isArray(entry.wins) && entry.wins.length > 0
    ? `\n**Wins:** ${(entry.wins as string[]).join(', ')}` : '';
  const challenges = Array.isArray(entry.challenges) && entry.challenges.length > 0
    ? `\n**Challenges:** ${(entry.challenges as string[]).join(', ')}` : '';

  let sleepSection = '';
  if (sleep) {
    const duration = sleep.sleep_duration_minutes
      ? `${Math.floor(sleep.sleep_duration_minutes / 60)}h ${sleep.sleep_duration_minutes % 60}m` : 'N/A';
    sleepSection = `\n## Sleep\nWake: ${sleep.wake_up_time || 'N/A'} | Mood: ${sleep.wake_up_mood || 'N/A'}/5 | Sleep: ${sleep.sleep_time || 'N/A'} | Duration: ${duration}\n`;
  }

  return `---
date: "${date}"
mood: ${entry.mood ?? 'null'}
energy: ${entry.energy_level ?? 'null'}
synced_at: "${new Date().toISOString()}"
---

# ${date}

## Diary
${entry.summary || '*No summary*'}
${wins}${challenges}

## Tasks
${taskLines}
${sleepSection}`;
}

function sleepMonthToMarkdown(logs: any[], month: string): string {
  const entries = logs
    .filter((log: any) => log.date.startsWith(month))
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((log: any) => {
      const duration = log.sleep_duration_minutes
        ? `${Math.floor(log.sleep_duration_minutes / 60)}h ${log.sleep_duration_minutes % 60}m` : 'N/A';
      return `### ${log.date}\n- Wake: ${log.wake_up_time || 'N/A'} | Mood: ${log.wake_up_mood || 'N/A'}/5\n- Sleep: ${log.sleep_time || 'N/A'} | Duration: ${duration}`;
    }).join('\n\n');

  return `---
month: "${month}"
type: "sleep-log"
synced_at: "${new Date().toISOString()}"
---

# Sleep Log — ${month}

${entries || '*No entries this month*'}
`;
}

export async function POST() {
  try {
    if (!github.isConfigured()) {
      return NextResponse.json({ success: false, error: 'GitHub not configured' }, { status: 503 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || FALLBACK_USER_ID;
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch all data in parallel
    const [
      { data: goals },
      { data: tasks },
      { data: dailyEntries },
      { data: dailyTaskStatus },
      { data: sleepLogs },
    ] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', userId),
      supabase.from('tasks').select('*, goals(title)').eq('user_id', userId),
      supabase.from('daily_entries').select('*').eq('user_id', userId).order('date', { ascending: true }),
      supabase.from('daily_task_status').select('*').eq('user_id', userId),
      supabase.from('sleep_wake_logs').select('*').eq('user_id', userId),
    ]);

    // 2. Build lookup maps
    const tasksByGoalId = new Map<string, any[]>();
    const dailyTasks: any[] = [];

    (tasks || []).forEach((t: any) => {
      if (t.goal_id) {
        if (!tasksByGoalId.has(t.goal_id)) tasksByGoalId.set(t.goal_id, []);
        tasksByGoalId.get(t.goal_id)!.push({ ...t, goal_title: t.goals?.title });
      }
      if (t.is_daily) {
        dailyTasks.push({ ...t, goal_title: t.goals?.title });
      }
    });

    const dailyTaskStatusByDate = new Map<string, any[]>();
    (dailyTaskStatus || []).forEach((s: any) => {
      if (!dailyTaskStatusByDate.has(s.date)) dailyTaskStatusByDate.set(s.date, []);
      dailyTaskStatusByDate.get(s.date)!.push(s);
    });

    const sleepByDate = new Map<string, any>();
    (sleepLogs || []).forEach((s: any) => { sleepByDate.set(s.date, s); });

    // 3. Check which Daily files already exist (preserve historical immutability)
    const existingDailyFiles = new Set<string>();
    try {
      const files = await github.listFiles('MTO/Daily');
      files.forEach((f: string) => {
        const match = f.match(/(\d{4}-\d{2}-\d{2})\.md$/);
        if (match) existingDailyFiles.add(match[1]);
      });
    } catch {
      // Directory may not exist yet — fine
    }

    // 4. Build files to sync
    const filesToSync: { path: string; content: string }[] = [];

    // Goal files — always overwrite (current state)
    (goals || []).forEach((goal: any) => {
      const slug = slugify(goal.title);
      const goalTasks = tasksByGoalId.get(goal.id) || [];
      filesToSync.push({ path: `MTO/Goals/${slug}.md`, content: goalToMarkdown(goal, goalTasks) });
    });

    // Daily files — skip historical ones that already exist
    (dailyEntries || []).forEach((entry: any) => {
      const date = entry.date as string;
      if (date !== todayStr && existingDailyFiles.has(date)) return; // immutable

      const completedTasks = dailyTaskStatusByDate.get(date) || [];
      // Only include tasks that existed on this date (created_at <= date)
      const tasksOnDate = dailyTasks.filter((t: any) =>
        t.created_at.split('T')[0] <= date
      );
      filesToSync.push({
        path: `MTO/Daily/${date}.md`,
        content: dailyToMarkdown(entry, completedTasks, tasksOnDate, sleepByDate.get(date) ?? null),
      });
    });

    // Sleep files — monthly
    const months = [...new Set((sleepLogs || []).map((s: any) => s.date.substring(0, 7)))];
    months.forEach(month => {
      const [year, monthNum] = month.split('-');
      filesToSync.push({
        path: `MTO/Sleep/${year}-${monthNum}.md`,
        content: sleepMonthToMarkdown(sleepLogs || [], month),
      });
    });

    // 5. Atomic commit
    let synced = 0;
    let failed = 0;
    if (filesToSync.length > 0) {
      const result = await github.batchUpsert(filesToSync, `[MTO] Time-series sync (${filesToSync.length} files)`);
      synced = result.success;
      failed = result.failed;
    }

    // 6. Cleanup old structure (best-effort)
    for (const dir of ['MTO/Data', 'MTO/Diary', 'MTO/Tasks', 'trash/MTO']) {
      try {
        const files = await github.listFiles(dir);
        for (const file of files) {
          await github.softDeleteFile(file, '[MTO] Cleanup legacy structure');
        }
      } catch {
        // Directory doesn't exist — skip
      }
    }

    return NextResponse.json({ success: true, results: { synced, failed, files: filesToSync.length } });

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
