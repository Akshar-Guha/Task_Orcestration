import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { renderReadinessBlock } from '../_shared/health-blocks.ts';

// FIX: Removed inline corsHeaders duplicate; import from _shared/cors.ts
// FIX: Moved env var reads to module level so missing vars are caught early
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const USER_EMAIL = Deno.env.get('USER_EMAIL') || '';
const USER_ID = Deno.env.get('DEFAULT_USER_ID') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // FIX: Validate required env vars before doing any work
    if (!USER_ID) {
      throw new Error('DEFAULT_USER_ID not configured');
    }
    if (!USER_EMAIL) {
      throw new Error('USER_EMAIL not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Optional readiness payload (same shape as wake-up-email's body.health)
    let health: unknown = null;
    try {
      const body = await req.json();
      health = body?.health ?? null;
    } catch {
      // No body → no readiness block
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Get today's goals
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('id, title, status, priority')
      .eq('user_id', USER_ID)
      .eq('is_archived', false)
      .in('status', ['not_started', 'in_progress'])
      .order('priority', { ascending: false })
      .limit(5);

    // FIX: Log query errors instead of silently swallowing them
    if (goalsError) {
      console.error('Error fetching goals:', goalsError);
    }

    // 2. Get today's tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, is_completed, estimated_minutes')
      .eq('user_id', USER_ID)
      .eq('is_archived', false)
      .eq('is_completed', false)
      .limit(10);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
    }

    // 3. Build email content
    const goalsHtml = goals?.length
      ? goals.map((g: any) => `<li><strong>${g.title}</strong> - ${g.status}</li>`).join('')
      : '<li>No active goals</li>';

    const tasksHtml = tasks?.length
      ? tasks.map((t: any) => `<li>${t.title} (${t.estimated_minutes || 30} min)</li>`).join('')
      : '<li>No pending tasks - add some!</li>';

    // FIX: Added charset=utf-8 meta; replaced garbled emoji literals with HTML entities
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }
    h1 { color: #60a5fa; }
    h2 { color: #a78bfa; margin-top: 24px; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .footer { margin-top: 32px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>&#9728;&#65039; Morning Briefing</h1>
  <p>Good morning! Here is your automated briefing for <strong>${today}</strong>.</p>
  ${renderReadinessBlock(health)}
  <h2>&#127919; Today's Goals</h2>
  <ul>${goalsHtml}</ul>
  <h2>&#9989; Tasks to Complete</h2>
  <ul>${tasksHtml}</ul>
  <div class="footer">
    <p>Sent by Goal Tracker &bull; <a href="https://your-goal-tracker.vercel.app" style="color: #60a5fa;">Open Dashboard</a></p>
  </div>
</body>
</html>
`;

    // 4. Send email via Resend
    if (RESEND_API_KEY) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Goal Tracker <noreply@resend.dev>',
          to: [USER_EMAIL],
          subject: `Morning Briefing - ${today}`,
          html: emailHtml
        })
      });

      if (!resendResponse.ok) {
        // FIX: Throw on Resend failure so caller gets 500 instead of silent success
        const errText = await resendResponse.text();
        throw new Error(`Resend error: ${errText}`);
      }
    } else {
      console.log('Skipping email send - RESEND_API_KEY not set.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        goalsCount: goals?.length || 0,
        tasksCount: tasks?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
