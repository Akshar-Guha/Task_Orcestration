import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { getDateInTimeZone, resolveUserTimeZone } from '@/lib/server-user-context';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/diary/quick?mood=4
// Called by one-click mood buttons in the night email.
// Upserts today's diary entry with the given mood, then redirects to /diary/quick.
export async function GET(request: NextRequest) {
  const userId = getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'User not configured' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const moodParam = searchParams.get('mood');
  const mood = moodParam ? parseInt(moodParam, 10) : null;

  if (!mood || mood < 1 || mood > 5) {
    return NextResponse.json({ error: 'Invalid mood value (1-5 required)' }, { status: 400 });
  }

  const timezone = await resolveUserTimeZone(supabase, userId, request);
  const today = getDateInTimeZone(timezone);

  // Check if entry exists for today
  const { data: existing } = await supabase
    .from('daily_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    // Update mood on existing entry
    await supabase
      .from('daily_entries')
      .update({ mood, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('user_id', userId);
  } else {
    // Create a new entry with just the mood
    await supabase
      .from('daily_entries')
      .insert({
        user_id: userId,
        date: today,
        mood,
        productivity_data: {},
        user_timezone: timezone,
      });
  }

  // Redirect to the quick check-in page with mood pre-filled and saved flag
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return NextResponse.redirect(`${appUrl}/diary/quick?mood=${mood}&saved=true`);
}

// POST /api/diary/quick
// Called by the /diary/quick page form submission.
// Upserts today's diary entry with mood, win, and challenge.
export async function POST(request: NextRequest) {
  const userId = getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'User not configured' }, { status: 401 });
  }

  const body = await request.json();
  const { mood, win, challenge } = body;

  if (!mood || mood < 1 || mood > 5) {
    return NextResponse.json({ error: 'Invalid mood value (1-5 required)' }, { status: 400 });
  }

  const timezone = await resolveUserTimeZone(supabase, userId, request);
  const today = getDateInTimeZone(timezone);

  const wins = win?.trim() ? [win.trim()] : [];
  const challenges = challenge?.trim() ? [challenge.trim()] : [];

  // Check if entry exists for today
  const { data: existing } = await supabase
    .from('daily_entries')
    .select('id, wins, challenges')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    // Merge wins/challenges with any existing ones
    const mergedWins = [...(existing.wins || []), ...wins].filter(Boolean);
    const mergedChallenges = [...(existing.challenges || []), ...challenges].filter(Boolean);

    const { error } = await supabase
      .from('daily_entries')
      .update({
        mood,
        wins: mergedWins,
        challenges: mergedChallenges,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from('daily_entries')
      .insert({
        user_id: userId,
        date: today,
        mood,
        wins,
        challenges,
        productivity_data: {},
        user_timezone: timezone,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Fetch top active goal for the "tomorrow's focus" message
  const { data: topGoal } = await supabase
    .from('goals')
    .select('title')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .in('status', ['not_started', 'in_progress'])
    .order('priority', { ascending: true })
    .limit(1)
    .single();

  // Calculate streak (days with entries in a row)
  const { data: recentEntries } = await supabase
    .from('daily_entries')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30);

  let streak = 0;
  if (recentEntries?.length) {
    const dates = recentEntries.map(e => e.date);
    // Use the timezone-aware 	oday (already computed above) as the streak anchor
    // to avoid crossing midnight issues when the server is in a different timezone
    for (let i = 0; i < 30; i++) {
      const anchor = new Date(today + 'T12:00:00Z');
      anchor.setUTCDate(anchor.getUTCDate() - i);
      const dateStr = anchor.toISOString().split('T')[0];
      if (dates.includes(dateStr)) {
        streak++;
      } else {
        break;
      }
    }
  }

  return NextResponse.json({
    success: true,
    streak,
    topGoal: topGoal?.title || null,
  });
}
