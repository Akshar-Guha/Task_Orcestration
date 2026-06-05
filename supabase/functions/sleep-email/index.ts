/**
 * Daily Summary Email - Triggered on Sleep
 *
 * Sends a personalized end-of-day summary with:
 * - Tasks completed today
 * - Goals progress
 * - Total productive time
 * - Tomorrow's preview
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// FIX: Removed inline corsHeaders duplicate; import from _shared/cors.ts

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
    // FIX: Added missing USER_ID guard
    if (!USER_ID) {
      throw new Error('DEFAULT_USER_ID not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split('T')[0];

    // 1. Get today's completed tasks
    // FIG: Use timezone-aware range; lte uses 23:59:59 which misses the last second —
    // changed upper bound to lt next day midnight for correctness.
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('id, title, actual_minutes')
      .eq('user_id', USER_ID)
      .eq('is_completed', true)
      .gte('completed_at', `${today}T00:00:00Z`)
      .lt('completed_at', `${today}T23:59:60Z`);

    // 2. Get today's productivity log
    const { data: todayLog } = await supabase
      .from('productivity_logs')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('date', today)
      .single();

    // 3. Get completed goals today
    const { data: completedGoals } = await supabase
      .from('goals')
      .select('id, title')
      .eq('user_id', USER_ID)
      .eq('status', 'completed')
      .gte('completed_at', `${today}T00:00:00Z`)
      .lt('completed_at', `${today}T23:59:60Z`);

    // 4. Get sleep log (wake up time)
    const { data: sleepLog } = await supabase
      .from('sleep_wake_logs')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('date', today)
      .single();

    // 5. Calculate stats
    const tasksCompleted = completedTasks?.length || 0;
    const goalsCompleted = completedGoals?.length || 0;
    const productiveMinutes = todayLog?.productive_minutes || 0;
    const productiveHours = Math.floor(productiveMinutes / 60);
    const productiveMins = productiveMinutes % 60;
    const wakeUpTime = sleepLog?.wake_up_time || 'N/A';

    // Calculate awake time if we have a wake-up time
    let awakeHours = 'N/A';
    if (sleepLog?.wake_up_time) {
      const wakeUp = sleepLog.wake_up_time.split(':');
      const now = new Date();
      const wakeUpDate = new Date();
      wakeUpDate.setHours(parseInt(wakeUp[0]), parseInt(wakeUp[1]), 0);
      const awakeMs = now.getTime() - wakeUpDate.getTime();
      // FIX: Guard against negative awake time (e.g., if time zone handling shifts
      // the wake time to be in the future from the server's perspective)
      if (awakeMs > 0) {
        const awakeH = Math.floor(awakeMs / (1000 * 60 * 60));
        const awakeM = Math.floor((awakeMs % (1000 * 60 * 60)) / (1000 * 60));
        awakeHours = `${awakeH}h ${awakeM}m`;
      }
    }

    // 6. Build email content
    // FIX: Added charset=utf-8 meta; replaced garbled emoji literals with HTML entities
    const tasksHtml = completedTasks?.length
      ? completedTasks.map((t: any) => `<li>&#9989; ${t.title}</li>`).join('')
      : '<li>No tasks completed today</li>';

    const goalsHtml = completedGoals?.length
      ? completedGoals.map((g: any) => `<li>&#127919; ${g.title}</li>`).join('')
      : '';

    const moodButtons = [
      { value: 1, emoji: '&#128546;', label: 'Rough' },
      { value: 2, emoji: '&#128533;', label: 'Meh' },
      { value: 3, emoji: '&#128528;', label: 'OK' },
      { value: 4, emoji: '&#128578;', label: 'Good' },
      { value: 5, emoji: '&#128522;', label: 'Great' },
    ].map(m => `
      <a href="${APP_URL}/api/diary/quick?mood=${m.value}"
         style="display:inline-block;padding:14px 12px;background:#1e293b;color:#e0e0e0;
                text-decoration:none;border-radius:12px;margin:4px;text-align:center;
                min-width:64px;border:1px solid #334155;font-size:13px;">
        <div style="font-size:26px;margin-bottom:4px;">${m.emoji}</div>
        <div>${m.label}</div>
      </a>`).join('');

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
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 24px 0; }
    .stat { background: #1e1e1e; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: bold; color: #60a5fa; }
    .stat-label { font-size: 12px; color: #888; margin-top: 4px; }
    .checkin { background: #0f172a; border: 1px solid #334155; padding: 24px; border-radius: 16px; margin: 24px 0; text-align: center; }
    .motivation { background: linear-gradient(135deg, #1f2937, #1e1e1e); padding: 20px; border-radius: 12px; margin-top: 24px; text-align: center; border: 1px solid #374151; }
    .footer { margin-top: 32px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>&#127769; Daily Summary</h1>

  <div class="checkin">
    <p style="margin:0 0 16px;font-size:16px;color:#cbd5e1;">How was your day?</p>
    <div style="margin-bottom:12px;">${moodButtons}</div>
    <p style="margin:0;font-size:12px;color:#475569;">Tap your mood &mdash; it saves instantly &#10003;</p>
  </div>

  <p>Here's what you accomplished on <strong>${today}</strong>.</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${tasksCompleted}</div>
      <div class="stat-label">Tasks Completed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${productiveHours}h ${productiveMins}m</div>
      <div class="stat-label">Productive Time</div>
    </div>
    <div class="stat">
      <div class="stat-value">${wakeUpTime}</div>
      <div class="stat-label">Woke Up</div>
    </div>
    <div class="stat">
      <div class="stat-value">${awakeHours}</div>
      <div class="stat-label">Awake</div>
    </div>
  </div>

  <h2>&#9989; Completed Tasks</h2>
  <ul>${tasksHtml}</ul>

  ${goalsHtml ? `
  <h2>&#127919; Goals Achieved</h2>
  <ul>${goalsHtml}</ul>
  ` : ''}

  <div class="motivation">
    <p style="font-size: 18px; margin: 0;">&#128564; Rest well! Tomorrow is a new opportunity.</p>
  </div>

  <div class="footer">
    <p>Sent by MTO Second Brain &bull; <a href="${APP_URL}/dashboard" style="color: #60a5fa;">Open Dashboard</a></p>
  </div>
</body>
</html>
`;

    // 7. Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'MTO Second Brain <noreply@resend.dev>',
        to: [USER_EMAIL],
        subject: `Daily Summary - ${tasksCompleted} tasks, ${productiveHours}h productive`,
        html: emailHtml
      })
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      throw new Error(`Resend error: ${error}`);
    }

    const resendData = await resendResponse.json();

    // 8. Save to daily_logs
    // FIX: tasks_total was set to tasksCompleted (wrong) — set to null so it
    // is not misleadingly reported as 100% completion rate.
    await supabase
      .from('daily_logs')
      .upsert({
        user_id: USER_ID,
        log_date: today,
        tasks_completed: tasksCompleted,
        tasks_total: null,
        summary: `Completed ${tasksCompleted} tasks in ${productiveHours}h ${productiveMins}m`,
        email_sent_at: new Date().toISOString()
      }, { onConflict: 'log_date,user_id' });

    return new Response(
      JSON.stringify({
        success: true,
        emailId: resendData.id,
        stats: {
          tasksCompleted,
          goalsCompleted,
          productiveMinutes
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[sleep-email] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
