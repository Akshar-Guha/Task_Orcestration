import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const USER_EMAIL = Deno.env.get('USER_EMAIL') || '';
const USER_ID = Deno.env.get('DEFAULT_USER_ID') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];

    // 1. Get today's goals
    const { data: goals } = await supabase
      .from('goals')
      .select('id, title, status, priority')
      .eq('user_id', USER_ID)
      .eq('is_archived', false)
      .in('status', ['not_started', 'in_progress'])
      .order('priority', { ascending: false })
      .limit(5);

    // 2. Get today's tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, is_completed, estimated_minutes')
      .eq('user_id', USER_ID)
      .eq('is_archived', false)
      .eq('is_completed', false)
      .limit(10);

    // 4. Build email content
    const goalsHtml = goals?.length
      ? goals.map((g: any) => `<li><strong>${g.title}</strong> - ${g.status}</li>`).join('')
      : '<li>No active goals</li>';

    const tasksHtml = tasks?.length
      ? tasks.map((t: any) => `<li>${t.title} (${t.estimated_minutes || 30} min)</li>`).join('')
      : '<li>No pending tasks - add some!</li>';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
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
  <h1>☀️ Morning Briefing</h1>
  
  <p>Good morning! Here is your automated briefing for <strong>${today}</strong>.</p>
  
  <h2>🎯 Today's Goals</h2>
  <ul>${goalsHtml}</ul>
  
  <h2>✅ Tasks to Complete</h2>
  <ul>${tasksHtml}</ul>
  
  <div class="footer">
    <p>Sent by Goal Tracker • <a href="https://your-goal-tracker.vercel.app" style="color: #60a5fa;">Open Dashboard</a></p>
  </div>
</body>
</html>
`;

    // 5. Send email via Resend
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
            subject: `☀️ Morning Briefing - ${today}`,
            html: emailHtml
        })
        });

        if (!resendResponse.ok) {
            console.error('Resend error:', await resendResponse.text());
        }
    } else {
        console.log('Skipping email send - RESEND_API_KEY not set. Content generated.');
    }

    return new Response(
      JSON.stringify({
        success: true,
        goalsCount: goals?.length || 0,
        tasksCount: tasks?.length || 0,
        preview: emailHtml // Return preview for user
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
