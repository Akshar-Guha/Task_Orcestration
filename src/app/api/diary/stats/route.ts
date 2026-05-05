import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';
import { cache, cacheKeys, cacheTTL, getWithCache } from '@/lib/diary-cache';
import { getDateInTimeZone, resolveUserTimeZone } from '@/lib/server-user-context';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StreakResult {
  current_streak: number;
  longest_streak: number;
  last_entry_date: string | null;
}

interface WeeklyStats {
  week_start: string;
  entries_count: number;
  avg_mood: number | null;
  avg_energy: number | null;
  total_deep_work: number;
  total_exercise: number;
  total_wins: number;
  total_challenges: number;
}

interface MonthlyStats {
  month_start: string;
  entries_count: number;
  avg_mood: number | null;
  avg_energy: number | null;
  total_deep_work: number;
  total_shallow_work: number;
  total_meetings: number;
  total_exercise: number;
  good_mood_days: number;
  bad_mood_days: number;
}

// GET /api/diary/stats - Get diary statistics
export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    await supabase.rpc('refresh_diary_stats');
    cache.deletePattern(`stats:*:${userId}`);
    cache.delete(cacheKeys.streak(userId));
    const timezone = await resolveUserTimeZone(supabase, userId, request);

    if (type === 'streak') {
      const streak = await getWithCache<StreakResult>(
        cacheKeys.streak(userId),
        cacheTTL.streak,
        async () => {
          // Pass local date to ensure timezone consistency
          const today = searchParams.get('referenceDate') || getDateInTimeZone(timezone);
          const { data } = await supabase.rpc('calculate_diary_streak', { 
            p_user_id: userId,
            p_reference_date: today 
          });
          return data?.[0] || { current_streak: 0, longest_streak: 0, last_entry_date: null };
        }
      );
      return NextResponse.json({ streak });
    }

    if (type === 'weekly') {
      const weeks = parseInt(searchParams.get('weeks') || '4');
      
      const weeklyStats = await getWithCache<WeeklyStats[]>(
        cacheKeys.weeklyStats(userId),
        cacheTTL.stats,
        async () => {
          const { data } = await supabase
            .from('diary_weekly_stats')
            .select('*')
            .eq('user_id', userId)
            .order('week_start', { ascending: false })
            .limit(weeks);
          return data || [];
        }
      );
      
      return NextResponse.json({ weeklyStats });
    }

    if (type === 'monthly') {
      const months = parseInt(searchParams.get('months') || '6');
      
      const monthlyStats = await getWithCache<MonthlyStats[]>(
        `stats:monthly:${userId}`,
        cacheTTL.stats,
        async () => {
          const { data } = await supabase
            .from('diary_monthly_stats')
            .select('*')
            .eq('user_id', userId)
            .order('month_start', { ascending: false })
            .limit(months);
          return data || [];
        }
      );
      
      return NextResponse.json({ monthlyStats });
    }

    // Default: overview with all stats
    const [streakResult, weeklyResult, monthlyResult] = await Promise.all([
      getWithCache<StreakResult>(
        cacheKeys.streak(userId),
        cacheTTL.streak,
        async () => {
          const today = searchParams.get('referenceDate') || getDateInTimeZone(timezone);
          const { data } = await supabase.rpc('calculate_diary_streak', { 
            p_user_id: userId,
            p_reference_date: today
          });
          return data?.[0] || { current_streak: 0, longest_streak: 0, last_entry_date: null };
        }
      ),
      getWithCache<WeeklyStats[]>(
        cacheKeys.weeklyStats(userId),
        cacheTTL.stats,
        async () => {
          const { data } = await supabase
            .from('diary_weekly_stats')
            .select('*')
            .eq('user_id', userId)
            .order('week_start', { ascending: false })
            .limit(4);
          return data || [];
        }
      ),
      getWithCache<MonthlyStats[]>(
        `stats:monthly:${userId}`,
        cacheTTL.stats,
        async () => {
          const { data } = await supabase
            .from('diary_monthly_stats')
            .select('*')
            .eq('user_id', userId)
            .order('month_start', { ascending: false })
            .limit(3);
          return data || [];
        }
      ),
    ]);

    return NextResponse.json({
      streak: streakResult,
      weeklyStats: weeklyResult,
      monthlyStats: monthlyResult,
      cacheStats: cache.stats(),
    });
  } catch (error) {
    console.error('[Stats API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/diary/stats/refresh - Manually refresh materialized views
export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'User not configured' }, { status: 401 });
    }

    // Refresh materialized views
    const { error } = await supabase.rpc('refresh_diary_stats');
    
    if (error) {
      console.error('[Stats API] Refresh error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clear stats cache
    cache.deletePattern(`stats:*:${userId}`);
    cache.delete(cacheKeys.streak(userId));

    return NextResponse.json({ success: true, message: 'Stats refreshed' });
  } catch (error) {
    console.error('[Stats API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
