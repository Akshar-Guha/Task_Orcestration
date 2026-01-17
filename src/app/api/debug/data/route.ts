/**
 * Debug API - Check Supabase Data
 * 
 * This endpoint checks what data exists in Supabase for the current user.
 * Used to diagnose data persistence issues.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const FALLBACK_USER_ID = '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

export async function GET() {
  try {
    // Check Supabase connection
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || FALLBACK_USER_ID;

    // Query all tables
    const [goalsRes, tasksRes, slotsRes] = await Promise.all([
      supabase.from('goals').select('id, title, created_at').eq('user_id', userId),
      supabase.from('tasks').select('id, title, created_at').eq('user_id', userId),
      supabase.from('time_slots').select('id, name, created_at').eq('user_id', userId),
    ]);

    const diagnostics = {
      timestamp: new Date().toISOString(),
      userId: userId,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 50) + '...',
      results: {
        goals: {
          count: goalsRes.data?.length || 0,
          error: goalsRes.error?.message || null,
          sample: goalsRes.data?.slice(0, 3) || [],
        },
        tasks: {
          count: tasksRes.data?.length || 0,
          error: tasksRes.error?.message || null,
          sample: tasksRes.data?.slice(0, 3) || [],
        },
        timeSlots: {
          count: slotsRes.data?.length || 0,
          error: slotsRes.error?.message || null,
          sample: slotsRes.data?.slice(0, 3) || [],
        },
      },
    };

    return NextResponse.json(diagnostics);
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
