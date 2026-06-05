/**
 * Debug API - Check Supabase Data
 * 
 * This endpoint checks what data exists in Supabase for the current user.
 * Used to diagnose data persistence issues.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? '';

export async function GET(request: Request) {
  // Fix: require DEBUG_SECRET to protect sensitive diagnostic data
  const secret = request.headers.get('x-debug-secret');
  if (process.env.DEBUG_SECRET && secret !== process.env.DEBUG_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    // Fix: use env-configured user ID (service-role client has no session)
    const userId = FALLBACK_USER_ID;

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
