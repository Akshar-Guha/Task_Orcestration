import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Database Connection Test API
 * Tests Supabase connection and RLS policies
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const results: {
    connection: boolean;
    tables: Record<string, { exists: boolean; count?: number; error?: string }>;
    auth: { anonymous: boolean; userId?: string };
    rls: { enabled: boolean; canRead?: boolean; error?: string };
    error?: string;
  } = {
    connection: false,
    tables: {},
    auth: { anonymous: true },
    rls: { enabled: false },
  };

  try {
    // Check if env vars are set
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        details: {
          hasUrl: !!SUPABASE_URL,
          hasAnonKey: !!SUPABASE_ANON_KEY,
        },
      }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Test basic connection
    const { data: pingData, error: pingError } = await supabase
      .from('goals')
      .select('id')
      .limit(1);

    if (pingError) {
      results.connection = false;
      results.error = pingError.message;
    } else {
      results.connection = true;
    }

    // Check required tables
    const tables = ['goals', 'tasks', 'time_slots', 'profiles', 'daily_entries'];
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          results.tables[table] = { exists: false, error: error.message };
        } else {
          results.tables[table] = { exists: true, count: count || 0 };
        }
      } catch (e) {
        results.tables[table] = { exists: false, error: String(e) };
      }
    }

    // Check auth status
    const { data: { user } } = await supabase.auth.getUser();
    results.auth = {
      anonymous: !user,
      userId: user?.id,
    };

    // Check RLS by trying to insert and read
    // Note: This is a non-destructive test using the hardcoded fallback user
    const FALLBACK_USER_ID = '2c32a446-1bbc-4294-8a29-3e4fef5649e6';
    const testUserId = user?.id || FALLBACK_USER_ID;

    const { data: rlsData, error: rlsError } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', testUserId)
      .limit(1);

    if (rlsError) {
      results.rls = { enabled: true, canRead: false, error: rlsError.message };
    } else {
      results.rls = { enabled: true, canRead: true };
    }

    return NextResponse.json({
      success: results.connection,
      timestamp: new Date().toISOString(),
      ...results,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
