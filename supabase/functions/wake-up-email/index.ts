/**
 * Morning Briefing Email - Triggered on Wake Up
 * 
 * Sends a personalized morning briefing email with:
 * - Today's goals and tasks
 * - Yesterday's summary
 * - AI-generated motivation (via Khoj/LLM)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const USER_EMAIL = Deno.env.get('USER_EMAIL') || '';
const USER_ID = Deno.env.get('DEFAULT_USER_ID') || '';
const APP_URL = Deno.env.get('APP_URL') || 'https://your-goal-tracker.vercel.app';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }
    if (!USER_EMAIL) {
      throw new Error('USER_EMAIL not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body (optional mood from wake-up)
    let wakeUpMood = 'good';
    try {
      const body = await req.json();
      wakeUpMood = body.mood || 'good';
    } catch {
      // No body, use default
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Get top 3 active goals (critical → important → nice-to-have)
    const { data: goals } = await supabase
      .from('goals')
      .select('id, title, status, priority')
      .eq('user_id', USER_ID)
      .eq('is_archived', false)
      .in('status', ['not_started', 'in_progress'])
      .order('priority', { ascending: false })
      .limit(3);

    // 2. Get pending task counts per goal
    const goalIds = goals?.map(g => g.id) || [];
    const { data: tasks } = goalIds.length ? await supabase
      .from('tasks')
      .select('id, goal_id')
      .eq('user_id', USER_ID)
      .eq('is_archived', false)
      .eq('is_completed', false)
      .in('goal_id', goalIds) : { data: [] };

    // 3. Get yesterday's stats
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    const { data: yesterdayLog } = await supabase
      .from('productivity_logs')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('date', yesterdayDate)
      .single();

    // 4. Build email content
    const taskCountByGoal: Record<string, number> = {};
    for (const t of (tasks || [])) {
      if (t.goal_id) taskCountByGoal[t.goal_id] = (taskCountByGoal[t.goal_id] || 0) + 1;
    }

    const goalsHtml = goals?.length
      ? goals.map((g: { id: string; title: string; status: string }) => {
          const count = taskCountByGoal[g.id] || 0;
          const taskBadge = count > 0 ? `<span style="color:#94a3b8;font-size:12px;"> · ${count} task${count !== 1 ? 's' : ''}</span>` : '';
          return `<li><strong>${g.title}</strong>${taskBadge}</li>`;
        }).join('')
      : '<li>No active goals — <a href="${APP_URL}/create" style="color:#a78bfa;">add one</a></li>';

    const yesterdaySummary = yesterdayLog
      ? `You were productive for <strong>${yesterdayLog.productive_minutes || 0} minutes</strong> yesterday.`
      : 'No productivity data from yesterday.';

    const moodEmoji = {
      'great': '😊',
      'good': '🙂',
      'okay': '😐',
      'bad': '😔',
      'terrible': '😢'
    }[wakeUpMood] || '🌅';

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
    .summary { background: #1e1e1e; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .cta { display:block; margin: 24px auto 0; padding: 14px 28px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; text-align: center; max-width: 200px; }
    .footer { margin-top: 32px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${moodEmoji} Good Morning!</h1>

  <p>Here's your focus for <strong>${today}</strong>.</p>

  <div class="summary">
    ${yesterdaySummary}
  </div>

  <h2>🎯 Today's Top Goals</h2>
  <ul>${goalsHtml}</ul>

  <a href="${APP_URL}/dashboard" class="cta">View Today's Plan →</a>

  <div class="footer">
    <p>Sent by MTO Second Brain • <a href="${APP_URL}/dashboard" style="color: #60a5fa;">Open Dashboard</a></p>
  </div>
</body>
</html>
`;

    // 5. Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'MTO Second Brain <noreply@resend.dev>',
        to: [USER_EMAIL],
        subject: `${moodEmoji} Morning Briefing - ${today}`,
        html: emailHtml
      })
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      throw new Error(`Resend error: ${error}`);
    }

    const resendData = await resendResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        emailId: resendData.id,
        goalsCount: goals?.length || 0,
        tasksCount: tasks?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[wake-up-email] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
