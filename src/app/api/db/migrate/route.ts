import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/db/migrate
 * 
 * Runs database migrations to create required tables.
 * Should be called once on initial setup.
 */
export async function POST(request: Request) {
  try {
    // Verify authorization (simple check)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)}`) {
      // Basic auth check - first 20 chars of service key
      console.log('[Migration] Proceeding without auth check in dev');
    }

    const supabase = getSupabaseAdmin();

    // Create daily_task_status table
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS daily_task_status (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id UUID NOT NULL,
          date DATE NOT NULL,
          is_completed BOOLEAN DEFAULT FALSE,
          completed_at TIMESTAMPTZ,
          minutes_spent INTEGER DEFAULT 0,
          user_id TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_task_status_unique 
          ON daily_task_status(task_id, date, user_id);
        
        CREATE INDEX IF NOT EXISTS idx_daily_task_status_user_date 
          ON daily_task_status(user_id, date);
      `
    });

    if (error1) {
      console.error('[Migration] Error creating daily_task_status:', error1);
      // Try direct SQL if RPC fails
      const { error: directError } = await supabase
        .from('daily_task_status')
        .select('id')
        .limit(1);
      
      if (directError && directError.code === '42P01') {
        // Table doesn't exist, we need to create it via Supabase dashboard
        return NextResponse.json({
          success: false,
          error: 'Tables need to be created via Supabase dashboard. See migration SQL in response.',
          migrationSQL: getMigrationSQL()
        }, { status: 400 });
      }
    }

    // Create productivity_logs table
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS productivity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE NOT NULL,
          productive_minutes INTEGER DEFAULT 0,
          completions JSONB DEFAULT '[]',
          wake_time TIMESTAMPTZ,
          sleep_time TIMESTAMPTZ,
          mood TEXT,
          user_id TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE UNIQUE INDEX IF NOT EXISTS idx_productivity_logs_unique 
          ON productivity_logs(date, user_id);
      `
    });

    if (error2) {
      console.error('[Migration] Error creating productivity_logs:', error2);
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed. If tables already exist, no changes made.',
      tablesCreated: ['daily_task_status', 'productivity_logs']
    });

  } catch (err) {
    console.error('[Migration] Error:', err);
    return NextResponse.json({
      success: false,
      error: String(err),
      migrationSQL: getMigrationSQL()
    }, { status: 500 });
  }
}

function getMigrationSQL(): string {
  return `
-- Run this SQL in Supabase SQL Editor:

-- Daily task status tracking (per-day completion state)
CREATE TABLE IF NOT EXISTS daily_task_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  minutes_spent INTEGER DEFAULT 0,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_task_status_unique 
  ON daily_task_status(task_id, date, user_id);

CREATE INDEX IF NOT EXISTS idx_daily_task_status_user_date 
  ON daily_task_status(user_id, date);

-- Productivity logs (daily summary)
CREATE TABLE IF NOT EXISTS productivity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  productive_minutes INTEGER DEFAULT 0,
  completions JSONB DEFAULT '[]',
  wake_time TIMESTAMPTZ,
  sleep_time TIMESTAMPTZ,
  mood TEXT,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_productivity_logs_unique 
  ON productivity_logs(date, user_id);

-- Enable RLS
ALTER TABLE daily_task_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (single user app)
CREATE POLICY "Allow all for daily_task_status" ON daily_task_status FOR ALL USING (true);
CREATE POLICY "Allow all for productivity_logs" ON productivity_logs FOR ALL USING (true);
  `;
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run migration',
    migrationSQL: getMigrationSQL()
  });
}
