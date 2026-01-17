/**
 * Debug API - Test Supabase Save
 * 
 * This endpoint tests saving a goal directly to Supabase to verify writes work.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const FALLBACK_USER_ID = '2c32a446-1bbc-4294-8a29-3e4fef5649e6';

export async function POST() {
  const testId = `test-${Date.now()}`;
  
  try {
    // Try to insert a test goal
    const { data, error } = await supabase
      .from('goals')
      .insert({
        id: testId,
        title: 'Test Goal ' + new Date().toISOString(),
        description: 'Testing Supabase write operation',
        level: 'lifetime',
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
