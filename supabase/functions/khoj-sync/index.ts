import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KHOJ_URL = Deno.env.get('KHOJ_URL') || '';
const KHOJ_API_KEY = Deno.env.get('KHOJ_API_KEY') || '';
const USER_ID = Deno.env.get('DEFAULT_USER_ID') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate config
    if (!KHOJ_URL) {
      return new Response(
        JSON.stringify({ success: false, error: 'KHOJ_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const files: { path: string; content: string }[] = [];
    const stats = { goals: 0, tasks: 0, memories: 0, timeSlots: 0 };

    // 1. Sync Goals (using ACTUAL snake_case schema)
    const { data: goals, error: goalsError } = await supabaseClient
      .from('goals')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('is_archived', false);

    if (!goalsError && goals) {
      for (const g of goals) {
        files.push({
          path: `goals/${g.id}.md`,
          content: goalToMarkdown(g)
        });
        stats.goals++;
      }
    }

    // 2. Sync Tasks (using ACTUAL snake_case schema)
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('is_archived', false);

    if (!tasksError && tasks) {
      for (const t of tasks) {
        files.push({
          path: `tasks/${t.id}.md`,
          content: taskToMarkdown(t)
        });
        stats.tasks++;
      }
    }

    // 3. Sync Memories (from obsidian-sync)
    const { data: memories, error: memoriesError } = await supabaseClient
      .from('memories')
      .select('*')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!memoriesError && memories) {
      for (const m of memories) {
        files.push({
          path: `memories/${m.id}.md`,
          content: memoryToMarkdown(m)
        });
        stats.memories++;
      }
    }

    // 4. Sync Time Slots
    const { data: timeSlots, error: slotsError } = await supabaseClient
      .from('time_slots')
      .select('*')
      .eq('user_id', USER_ID);

    if (!slotsError && timeSlots) {
      for (const s of timeSlots) {
        files.push({
          path: `time_slots/${s.id}.md`,
          content: timeSlotToMarkdown(s)
        });
        stats.timeSlots++;
      }
    }

    // 5. Push all files to Khoj
    if (files.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: stats, message: 'No data to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const khojResponse = await fetch(`${KHOJ_URL}/api/content/computer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KHOJ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files })
    });

    if (!khojResponse.ok) {
      const errorText = await khojResponse.text();
      throw new Error(`Khoj API error: ${khojResponse.status} - ${errorText}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: stats,
        totalFiles: files.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[khoj-sync] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================
// MARKDOWN CONVERTERS (using actual schema)
// ============================================

function goalToMarkdown(g: Record<string, unknown>): string {
  const snapshot = g.completion_snapshot as Record<string, unknown> | null;
  const completionStats = snapshot
    ? `
## Completion Stats
- Tasks: ${snapshot.completedTasks || 0}/${snapshot.totalTasks || 0}
- Days: ${snapshot.daysToComplete || 'N/A'}
- Minutes: ${snapshot.totalMinutesSpent || 0}
`
    : '';

  return `---
id: ${g.id}
title: "${g.title}"
level: ${g.level}
status: ${g.status}
priority: ${g.priority || 2}
created_at: ${g.created_at}
---

# ${g.title}

${g.description || ''}

## Status: ${g.status}
## Priority: ${g.priority === 1 ? 'Low' : g.priority === 3 ? 'Critical' : 'Normal'}

${completionStats}
`;
}

function taskToMarkdown(t: Record<string, unknown>): string {
  return `---
id: ${t.id}
title: "${t.title}"
goal_id: ${t.goal_id || 'none'}
is_completed: ${t.is_completed}
is_daily: ${t.is_daily}
estimated_minutes: ${t.estimated_minutes || 30}
created_at: ${t.created_at}
---

# Task: ${t.title}

${t.description || ''}

${t.is_completed ? '✅ Completed' : '⏳ Pending'}
`;
}

function memoryToMarkdown(m: Record<string, unknown>): string {
  const metadata = m.metadata as Record<string, unknown> | null;
  return `---
id: ${m.id}
created_at: ${m.created_at}
keywords: "${metadata?.keywords || ''}"
---

# Memory

${m.content}

${metadata?.keywords ? `**Keywords**: ${metadata.keywords}` : ''}
`;
}

function timeSlotToMarkdown(s: Record<string, unknown>): string {
  const goalIds = s.goal_ids as string[] || [];
  return `---
id: ${s.id}
name: "${s.name}"
type: ${s.type}
start_time: "${s.start_time}"
end_time: "${s.end_time}"
---

# Time Slot: ${s.name}

- Type: ${s.type}
- Time: ${s.start_time} - ${s.end_time}

## Goals
${goalIds.length ? goalIds.map(id => `- ${id}`).join('\n') : '*No goals*'}
`;
}
