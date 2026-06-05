/**
 * Debug API - Test Supabase Save
 * 
 * This endpoint tests saving a goal directly to Supabase to verify writes work.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FALLBACK_USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? '';

export async function POST(request: Request) {
  // Fix: require DEBUG_SECRET to prevent unauthorized test writes
  const secret = request.headers.get('x-debug-secret');
  if (process.env.DEBUG_SECRET && secret !== process.env.DEBUG_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!FALLBACK_USER_ID) {
    return NextResponse.json({ error: 'User ID not configured' }, { status: 500 });
  }
  const testId = crypto.randomUUID();
  
  try {
    // Try to insert a test goal
    const { data, error } = await supabase
      .from('goals')
      .insert({
        id: testId,
        title: 'Test Goal ' + new Date().toISOString(),
        description: 'Testing Supabase write operation',
        level: 'uncategorized',
        status: 'not_started',
        priority: 2,
        depends_on: [],
        unlocks: [],
        is_archived: false,
        user_id: FALLBACK_USER_ID,
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        hint: error.hint,
        testId,
      }, { status: 400 });
    }

    // Verify it was saved by reading it back
    const { data: readData, error: readError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', testId)
      .single();

    // Clean up - delete the test goal
    await supabase.from('goals').delete().eq('id', testId);

    return NextResponse.json({
      success: true,
      message: 'Write test PASSED!',
      savedData: data,
      readBack: readData,
      readError: readError?.message,
    });

  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
      testId,
    }, { status: 500 });
  }
}
