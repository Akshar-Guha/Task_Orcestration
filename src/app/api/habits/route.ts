import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUserId } from '@/lib/user';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const userId = getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'User not configured' }, { status: 401 });
  }

  const [habitsResult, completionsResult] = await Promise.all([
    supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('habit_completions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(200),
  ]);

  if (habitsResult.error) {
    return NextResponse.json({ error: habitsResult.error.message }, { status: 500 });
  }

  if (completionsResult.error) {
    return NextResponse.json({ error: completionsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    habits: habitsResult.data || [],
    completions: completionsResult.data || [],
  });
}
