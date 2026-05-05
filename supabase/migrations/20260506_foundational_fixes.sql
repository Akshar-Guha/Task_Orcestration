CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  window_days INTEGER NOT NULL DEFAULT 7 CHECK (window_days >= 1),
  step_goal INTEGER NOT NULL DEFAULT 10000 CHECK (step_goal > 0),
  sleep_target_hours REAL NOT NULL DEFAULT 8 CHECK (sleep_target_hours > 0),
  focus_goal_minutes INTEGER NOT NULL DEFAULT 120 CHECK (focus_goal_minutes > 0),
  stride_meters REAL NOT NULL DEFAULT 0.762 CHECK (stride_meters > 0),
  daily_summary_time TEXT DEFAULT '20:00',
  enable_daily_summary_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  daily_morning_time TEXT DEFAULT '07:00',
  enable_morning_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  enable_task_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  enable_goal_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  notification_offset_minutes INTEGER NOT NULL DEFAULT 5,
  theme TEXT DEFAULT 'dark',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '🎯',
  ADD COLUMN IF NOT EXISTS target_hours REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logged_hours REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id UUID,
  ADD COLUMN IF NOT EXISTS color_hex TEXT DEFAULT '#FF9500',
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

ALTER TABLE goals
  ALTER COLUMN level SET DEFAULT 'ad_hoc',
  ALTER COLUMN status SET DEFAULT 'not_started',
  ALTER COLUMN priority SET DEFAULT 2;

CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✅',
  target_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
  reminder_time TEXT,
  color_hex TEXT NOT NULL DEFAULT '#FF9500',
  streak INTEGER NOT NULL DEFAULT 0,
  completed_today BOOLEAN NOT NULL DEFAULT FALSE,
  skipped_today BOOLEAN NOT NULL DEFAULT FALSE,
  completion_rate REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id TEXT,
  app_version TEXT,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_habits_user_sort ON habits(user_id, sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_path TEXT,
  file_name TEXT,
  modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  embedding vector(384),
  embedding_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_user_file_path
  ON memories(user_id, file_path)
  WHERE file_path IS NOT NULL;

CREATE TABLE IF NOT EXISTS goal_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id TEXT,
  app_version TEXT,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_goal_time_logs_user_date ON goal_time_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_goal_time_logs_goal_date ON goal_time_logs(goal_id, date DESC);

CREATE TABLE IF NOT EXISTS daily_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  steps INTEGER NOT NULL DEFAULT 0,
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  habits_completed INTEGER NOT NULL DEFAULT 0,
  habits_total INTEGER NOT NULL DEFAULT 0,
  active_goals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id TEXT,
  app_version TEXT,
  session_id TEXT,
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE daily_entries
  ADD COLUMN IF NOT EXISTS embedding vector(384),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS extraction_model TEXT,
  ADD COLUMN IF NOT EXISTS user_timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

ALTER TABLE daily_entries DROP CONSTRAINT IF EXISTS daily_entries_date_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_entries_user_date_timezone
  ON daily_entries(user_id, date, user_timezone);

ALTER TABLE productivity_categories
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE productivity_categories DROP CONSTRAINT IF EXISTS productivity_categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_productivity_categories_user_name
  ON productivity_categories((COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)), name);

ALTER TABLE sensor_logs
  ADD COLUMN IF NOT EXISTS distance_source TEXT NOT NULL DEFAULT 'derived',
  ADD COLUMN IF NOT EXISTS active_minutes_source TEXT NOT NULL DEFAULT 'derived',
  ADD COLUMN IF NOT EXISTS stride_meters REAL NOT NULL DEFAULT 0.762,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

DROP INDEX IF EXISTS idx_sensor_logs_user_date;
ALTER TABLE sensor_logs
  DROP CONSTRAINT IF EXISTS sensor_logs_distance_meters_check;
ALTER TABLE sensor_logs
  ADD CONSTRAINT sensor_logs_distance_meters_check
  CHECK (distance_meters >= 0 AND distance_meters <= 100000);

ALTER TABLE habit_completions
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

ALTER TABLE habit_completions
  DROP CONSTRAINT IF EXISTS habit_completions_nudge_type_check;
ALTER TABLE habit_completions
  ADD CONSTRAINT habit_completions_nudge_type_check
  CHECK (
    nudge_type IS NULL OR nudge_type IN (
      'StreakRiskNudge',
      'IncompleteHabitsNudge',
      'StepProximityNudge',
      'DiaryReminderNudge',
      'GoalInactivityNudge',
      'LowActivityNudge'
    )
  );

ALTER TABLE sleep_wake_logs
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

ALTER TABLE readiness_scores
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

ALTER TABLE nudge_events
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'edges' AND column_name = 'id'
  ) THEN
    ALTER TABLE edges ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

    UPDATE edges e
    SET user_id = COALESCE(e.user_id, source_node.user_id, target_node.user_id)
    FROM nodes AS source_node
    LEFT JOIN nodes AS target_node ON target_node.id = e.target_id
    WHERE source_node.id = e.source_id
      AND e.user_id IS NULL;

    UPDATE edges
    SET user_id = (
      SELECT id
      FROM auth.users
      ORDER BY created_at
      LIMIT 1
    )
    WHERE user_id IS NULL;

    ALTER TABLE edges ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION refresh_diary_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DROP MATERIALIZED VIEW IF EXISTS diary_weekly_stats;
  CREATE MATERIALIZED VIEW diary_weekly_stats AS
  SELECT
    de.user_id,
    date_trunc('week', de.date::timestamp)::date AS week_start,
    COUNT(*)::integer AS entries_count,
    AVG(de.mood)::numeric(10,2) AS avg_mood,
    AVG(de.energy_level)::numeric(10,2) AS avg_energy,
    COALESCE(SUM((de.productivity_data->>'deep_work')::int), 0)::integer AS total_deep_work,
    COALESCE(SUM((de.productivity_data->>'exercise')::int), 0)::integer AS total_exercise,
    COALESCE(SUM(array_length(de.wins, 1)), 0)::integer AS total_wins,
    COALESCE(SUM(array_length(de.challenges, 1)), 0)::integer AS total_challenges
  FROM daily_entries de
  GROUP BY de.user_id, date_trunc('week', de.date::timestamp)::date;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_diary_weekly_stats_user_week
    ON diary_weekly_stats(user_id, week_start);

  DROP MATERIALIZED VIEW IF EXISTS diary_monthly_stats;
  CREATE MATERIALIZED VIEW diary_monthly_stats AS
  SELECT
    de.user_id,
    date_trunc('month', de.date::timestamp)::date AS month_start,
    COUNT(*)::integer AS entries_count,
    AVG(de.mood)::numeric(10,2) AS avg_mood,
    AVG(de.energy_level)::numeric(10,2) AS avg_energy,
    COALESCE(SUM((de.productivity_data->>'deep_work')::int), 0)::integer AS total_deep_work,
    COALESCE(SUM((de.productivity_data->>'shallow_work')::int), 0)::integer AS total_shallow_work,
    COALESCE(SUM((de.productivity_data->>'meetings')::int), 0)::integer AS total_meetings,
    COALESCE(SUM((de.productivity_data->>'exercise')::int), 0)::integer AS total_exercise,
    COUNT(*) FILTER (WHERE de.mood >= 4)::integer AS good_mood_days,
    COUNT(*) FILTER (WHERE de.mood <= 2)::integer AS bad_mood_days
  FROM daily_entries de
  GROUP BY de.user_id, date_trunc('month', de.date::timestamp)::date;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_diary_monthly_stats_user_month
    ON diary_monthly_stats(user_id, month_start);
END;
$$;

SELECT refresh_diary_stats();

CREATE OR REPLACE FUNCTION calculate_diary_streak(
  p_user_id UUID,
  p_reference_date DATE
)
RETURNS TABLE (
  current_streak INTEGER,
  longest_streak INTEGER,
  last_entry_date DATE
)
LANGUAGE sql
AS $$
WITH ordered_entries AS (
  SELECT DISTINCT date
  FROM daily_entries
  WHERE user_id = p_user_id
),
streak_groups AS (
  SELECT
    date,
    date - (ROW_NUMBER() OVER (ORDER BY date))::integer AS grp
  FROM ordered_entries
),
streaks AS (
  SELECT
    MIN(date) AS streak_start,
    MAX(date) AS streak_end,
    COUNT(*)::integer AS streak_length
  FROM streak_groups
  GROUP BY grp
)
SELECT
  COALESCE((
    SELECT streak_length
    FROM streaks
    WHERE streak_end = p_reference_date
       OR streak_end = p_reference_date - INTERVAL '1 day'
    ORDER BY streak_end DESC
    LIMIT 1
  ), 0)::integer AS current_streak,
  COALESCE((SELECT MAX(streak_length) FROM streaks), 0)::integer AS longest_streak,
  (SELECT MAX(date) FROM ordered_entries) AS last_entry_date;
$$;

CREATE OR REPLACE FUNCTION search_diary_entries(
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  date date,
  summary text,
  mood integer,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    de.id,
    de.date,
    de.summary,
    de.mood,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM daily_entries de
  WHERE de.user_id = p_user_id
    AND de.embedding IS NOT NULL
    AND 1 - (de.embedding <=> query_embedding) >= match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    m.id,
    m.content,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) >= match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;
