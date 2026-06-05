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
    // Fix: enforce auth — return 401 on mismatch instead of logging and continuing
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20)}`;
    if (!authHeader || authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Create web_push_subscriptions table
    const { error: error3 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS web_push_subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          auth TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          expiration_time BIGINT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_push_subs_user ON web_push_subscriptions(user_id);
        ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'web_push_subscriptions' AND policyname = 'Allow all for push subs') THEN
            CREATE POLICY "Allow all for push subs" ON web_push_subscriptions FOR ALL USING (true);
          END IF;
        END $$;
      `
    });
    if (error3) console.error('[Migration] web_push_subscriptions:', error3);

    // Create notification_rules table
    const { error: error4 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS notification_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          schedule_time TEXT,
          repeat_days INTEGER[],
          is_enabled BOOLEAN DEFAULT TRUE,
          is_manual BOOLEAN DEFAULT FALSE,
          snooze_interval_minutes INTEGER DEFAULT NULL,
          requires_acknowledgment BOOLEAN DEFAULT TRUE,
  notification_type TEXT DEFAULT 'custom',
  linked_entity_id UUID DEFAULT NULL,
  linked_entity_name TEXT DEFAULT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notif_rules_user ON notification_rules(user_id);
        ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_rules' AND policyname = 'Allow all for notif rules') THEN
            CREATE POLICY "Allow all for notif rules" ON notification_rules FOR ALL USING (true);
          END IF;
        END $$;

        -- Add/upgrade columns for entity-linked notifications
        ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS snooze_interval_minutes INTEGER DEFAULT NULL;
        ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS requires_acknowledgment BOOLEAN DEFAULT TRUE;
        ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'custom';
        ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS linked_entity_id UUID DEFAULT NULL;
        ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS linked_entity_name TEXT DEFAULT NULL;
        ALTER TABLE notification_rules DROP COLUMN IF EXISTS url;
        ALTER TABLE notification_rules DROP COLUMN IF EXISTS icon;
        ALTER TABLE notification_rules DROP COLUMN IF EXISTS auto_ack_type;

        CREATE TABLE IF NOT EXISTS notification_acks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_id UUID NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          acked_date DATE NOT NULL,
          acked_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_acks_unique ON notification_acks(rule_id, acked_date);
        ALTER TABLE notification_acks ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_acks' AND policyname = 'Allow all for notif acks') THEN
            CREATE POLICY "Allow all for notif acks" ON notification_acks FOR ALL USING (true);
          END IF;
        END $$;
      `
    });
    if (error4) console.error('[Migration] notification_rules:', error4);

    return NextResponse.json({
      success: true,
      message: 'Migration completed. If tables already exist, no changes made.',
      tablesCreated: ['daily_task_status', 'productivity_logs', 'web_push_subscriptions', 'notification_rules']
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

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  expiration_time BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON web_push_subscriptions(user_id);
ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for push subs" ON web_push_subscriptions FOR ALL USING (true);

-- Custom notification rules (with alarm/snooze support)
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  schedule_time TEXT,
  repeat_days INTEGER[],
  is_enabled BOOLEAN DEFAULT TRUE,
  is_manual BOOLEAN DEFAULT FALSE,
  snooze_interval_minutes INTEGER DEFAULT NULL,
  requires_acknowledgment BOOLEAN DEFAULT TRUE,
  notification_type TEXT DEFAULT 'custom',
  linked_entity_id UUID DEFAULT NULL,
  linked_entity_name TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_rules_user ON notification_rules(user_id);
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for notif rules" ON notification_rules FOR ALL USING (true);

-- Acknowledgment tracking (stops alarm re-firing for the day)
CREATE TABLE IF NOT EXISTS notification_acks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  acked_date DATE NOT NULL,
  acked_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_acks_unique ON notification_acks(rule_id, acked_date);
ALTER TABLE notification_acks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for notif acks" ON notification_acks FOR ALL USING (true);
  `;
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with Authorization: Bearer <first 20 chars of SUPABASE_SERVICE_ROLE_KEY> to run migration',
  });
}
