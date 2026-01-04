import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const USER_ID = Deno.env.get('DEFAULT_USER_ID') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    // Query today's tasks
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('nodes')
      .select('id, title, type, status, properties')
      .eq('user_id', USER_ID)
      .eq('type', 'task')
      .or(`properties->>due_date.gte.${startOfDay},properties->>due_date.lte.${endOfDay}`);

    // Query all goals for context
    const { data: goals, error: goalsError } = await supabaseClient
      .from('nodes')
      .select('id, title, properties')
      .eq('user_id', USER_ID)
      .eq('type', 'goal')
      .limit(5);

    // Query recent memories for context
    const { data: memories, error: memoriesError } = await supabaseClient
      .from('memories')
      .select('id, content, metadata')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(3);

    // Build context for AI
    const taskList = tasks?.map(t => `- ${t.title} (${t.status || 'pending'})`).join('\n') || 'No tasks scheduled';
    const goalList = goals?.map(g => `- ${g.title}`).join('\n') || 'No active goals';
    const recentNotes = memories?.map(m => m.metadata?.keywords || '').filter(Boolean).join(', ') || 'No recent notes';

    // Generate briefing with Groq
    let briefing = '';
    
    if (GROQ_API_KEY) {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{
            role: 'system',
            content: 'You are a helpful productivity assistant. Generate a concise, motivating morning briefing.'
          }, {
            role: 'user',
            content: `Generate a brief morning briefing (3-4 sentences max) based on:

TODAY'S TASKS:
${taskList}

ACTIVE GOALS:
${goalList}

RECENT FOCUS AREAS:
${recentNotes}

Keep it encouraging and action-oriented.`
          }],
          temperature: 0.7,
          max_tokens: 200
        })
      });

      if (groqResponse.ok) {
        const groqData = await groqResponse.json();
        briefing = groqData.choices[0]?.message?.content || 'Good morning! Ready to tackle your goals today.';
      }
    }

    // Save briefing to daily_logs
    const { data: log, error: logError } = await supabaseClient
      .from('daily_logs')
      .insert({
        user_id: USER_ID,
        log_date: new Date().toISOString().split('T')[0],
        summary: briefing,
        tasks_completed: 0,
        tasks_total: tasks?.length || 0
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        briefing: briefing,
        tasks_count: tasks?.length || 0,
        goals_count: goals?.length || 0,
        log_id: log?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
