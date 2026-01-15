-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Goals Table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL CHECK (level IN ('yearly', 'quarterly', 'monthly', 'ad_hoc')),
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold')),
  priority INTEGER DEFAULT 2 CHECK (priority IN (1, 2, 3)),
  depends_on UUID[],
  unlocks UUID[],
  time_slot_id UUID,
  is_archived BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  completion_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  actual_minutes INTEGER,
  is_daily BOOLEAN DEFAULT TRUE,
  is_completed BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time Slots Table
CREATE TABLE IF NOT EXISTS time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('morning', 'work', 'afternoon', 'evening', 'custom')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  color TEXT NOT NULL,
  goal_ids UUID[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productivity Logs Table
CREATE TABLE IF NOT EXISTS productivity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  productive_minutes INTEGER DEFAULT 0,
  total_waking_minutes INTEGER,
  wake_time TEXT,
  sleep_time TEXT,
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  completions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, user_id)
);

-- Sleep Wake Logs Table
CREATE TABLE IF NOT EXISTS sleep_wake_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  wake_up_time TEXT,
  wake_up_mood INTEGER CHECK (wake_up_mood BETWEEN 1 AND 5),
  wake_up_confirmed_at TIMESTAMPTZ,
  sleep_time TEXT,
  sleep_duration_minutes INTEGER,
  sleep_attempts TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, user_id)
);

-- Timeline Events Table
CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_user_id ON time_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_productivity_logs_user_date ON productivity_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON sleep_wake_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_timeline_events_user_id ON timeline_events(user_id);

-- RLS Policies
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_wake_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users on their own data
CREATE POLICY "Users can manage their own goals" ON goals
  FOR ALL USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their own tasks" ON tasks
  FOR ALL USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their own time slots" ON time_slots
  FOR ALL USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their own productivity logs" ON productivity_logs
  FOR ALL USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their own sleep logs" ON sleep_wake_logs
  FOR ALL USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their own timeline events" ON timeline_events
  FOR ALL USING (user_id::text = current_setting('request.jwt.claims', true)::json->>'sub');
