-- Migration: Security and schema fixes
-- Addresses bugs found in audit: BUG-SQL-01, BUG-SQL-02, BUG-SQL-03, BUG-SQL-05,
--   BUG-SQL-07, BUG-SQL-08, BUG-SQL-09, BUG-SQL-10

-- ============================================================
-- BUG-SQL-01: Replace fragile JWT claim RLS policies with auth.uid()
-- The initial schema used current_setting('request.jwt.claims')::json->>'sub'
-- which silently returns null outside HTTP context. Replace with auth.uid().
-- ============================================================

DO $$
BEGIN
  -- goals
  DROP POLICY IF EXISTS "Users can manage their own goals" ON goals;
  CREATE POLICY "Users can manage their own goals" ON goals
    FOR ALL USING (auth.uid() = user_id);

  -- tasks
  DROP POLICY IF EXISTS "Users can manage their own tasks" ON tasks;
  CREATE POLICY "Users can manage their own tasks" ON tasks
    FOR ALL USING (auth.uid() = user_id);

  -- time_slots
  DROP POLICY IF EXISTS "Users can manage their own time slots" ON time_slots;
  CREATE POLICY "Users can manage their own time slots" ON time_slots
    FOR ALL USING (auth.uid() = user_id);

  -- productivity_logs
  DROP POLICY IF EXISTS "Users can manage their own productivity logs" ON productivity_logs;
  CREATE POLICY "Users can manage their own productivity logs" ON productivity_logs
    FOR ALL USING (auth.uid() = user_id);

  -- sleep_wake_logs
  DROP POLICY IF EXISTS "Users can manage their own sleep logs" ON sleep_wake_logs;
  CREATE POLICY "Users can manage their own sleep logs" ON sleep_wake_logs
    FOR ALL USING (auth.uid() = user_id);

  -- timeline_events
  DROP POLICY IF EXISTS "Users can manage their own timeline events" ON timeline_events;
  CREATE POLICY "Users can manage their own timeline events" ON timeline_events
    FOR ALL USING (auth.uid() = user_id);
END $$;

-- ============================================================
-- BUG-SQL-02: Add authenticated-user policies alongside fallback UUID policies
-- Tables habit_completions, sensor_logs, readiness_scores, nudge_events
-- only had hardcoded-UUID fallback policies — authenticated JWT users were blocked.
-- ============================================================

DO $$
BEGIN
  -- habit_completions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'habit_completions'
      AND policyname = 'Authenticated user can manage habit_completions'
  ) THEN
    CREATE POLICY "Authenticated user can manage habit_completions" ON habit_completions
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- sensor_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sensor_logs'
      AND policyname = 'Authenticated user can manage sensor_logs'
  ) THEN
    CREATE POLICY "Authenticated user can manage sensor_logs" ON sensor_logs
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- readiness_scores and nudge_events (from ml_dataset_tables migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'readiness_scores') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'readiness_scores'
        AND policyname = 'Authenticated user can manage readiness_scores'
    ) THEN
      EXECUTE 'CREATE POLICY "Authenticated user can manage readiness_scores" ON readiness_scores
        FOR ALL USING (auth.uid() = user_id)';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nudge_events') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'nudge_events'
        AND policyname = 'Authenticated user can manage nudge_events'
    ) THEN
      EXECUTE 'CREATE POLICY "Authenticated user can manage nudge_events" ON nudge_events
        FOR ALL USING (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

-- ============================================================
-- BUG-SQL-03: timeline_events.details should be JSONB not TEXT
-- Edge functions write JSON objects; TEXT stores them as strings, not queryable.
-- Only run if no existing rows have non-JSON content.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timeline_events' AND column_name = 'details'
      AND data_type = 'text'
  ) THEN
    -- Only alter if all existing values are valid JSON or NULL
    IF NOT EXISTS (
      SELECT 1 FROM timeline_events
      WHERE details IS NOT NULL AND details !~ '^[\[\{"]'
    ) THEN
      ALTER TABLE timeline_events
        ALTER COLUMN details TYPE JSONB USING NULLIF(details, '')::jsonb;
    END IF;
  END IF;
END $$;

-- ============================================================
-- BUG-SQL-05: match_memories has no user_id filter — leaks memories across users
-- Recreate with optional p_user_id parameter.
-- ============================================================

CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, content text, metadata jsonb, similarity float)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id,
    m.content,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE
    m.embedding IS NOT NULL
    AND (p_user_id IS NULL OR m.user_id = p_user_id)
    AND 1 - (m.embedding <=> query_embedding) >= match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- BUG-SQL-07: daily_logs table referenced in sleep-email edge function
-- but never defined in any migration. Create it now.
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tasks_completed INT DEFAULT 0,
  tasks_total INT,
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  energy_level INT CHECK (energy_level BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own daily logs" ON daily_logs
  FOR ALL USING (auth.uid() = user_id);

-- Fallback policy for device-auth (anon key with known user_id)
DO $$
DECLARE
  fallback_uid UUID := '2c32a446-1bbc-4294-8a29-3e4fef5649e6';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_logs'
      AND policyname = 'Fallback device user can manage daily_logs'
  ) THEN
    EXECUTE format(
      'CREATE POLICY "Fallback device user can manage daily_logs" ON daily_logs
        FOR ALL USING (user_id = %L::uuid)',
      fallback_uid
    );
  END IF;
END $$;

-- ============================================================
-- BUG-SQL-08: habit_completions.habit_id has no FK to habits table
-- Add it now that habits table exists (created in foundational_fixes).
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'habits') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_habit_completions_habit'
    ) THEN
      ALTER TABLE habit_completions
        ADD CONSTRAINT fk_habit_completions_habit
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================
-- BUG-SQL-09: Add FK from user-scoped tables to auth.users
-- goals, tasks, time_slots, productivity_logs, sleep_wake_logs, timeline_events
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_goals_user'
  ) THEN
    ALTER TABLE goals ADD CONSTRAINT fk_goals_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tasks_user'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_time_slots_user'
  ) THEN
    ALTER TABLE time_slots ADD CONSTRAINT fk_time_slots_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_productivity_logs_user'
  ) THEN
    ALTER TABLE productivity_logs ADD CONSTRAINT fk_productivity_logs_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_sleep_wake_logs_user'
  ) THEN
    ALTER TABLE sleep_wake_logs ADD CONSTRAINT fk_sleep_wake_logs_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_timeline_events_user'
  ) THEN
    ALTER TABLE timeline_events ADD CONSTRAINT fk_timeline_events_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- BUG-SQL-10: sensor_logs unique index was dropped in foundational_fixes
-- but never recreated, removing the one-row-per-user-per-day guarantee.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_sensor_logs_user_date
  ON sensor_logs(user_id, date);
