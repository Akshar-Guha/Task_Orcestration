import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Test database connection by querying a simple table
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to Supabase database',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Connection failed',
      },
      { status: 500 }
    );
  }
}
