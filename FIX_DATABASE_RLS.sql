-- =================================================================
-- DATA PERSISTENCE FIX - RLS POLICIES FOR FALLBACK USER
-- =================================================================
-- 
-- PROBLEM: Row Level Security (RLS) is blocking writes to the database
-- because the app uses a fallback user ID when not authenticated.
--
-- SOLUTION: Create RLS policies that allow the fallback user to manage
-- their own data.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard
-- 2. Go to SQL Editor
-- 3. Paste this entire file and click "Run"
--
-- =================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing fallback user policies if they exist
-- (This ensures we start fresh and don't get "policy already exists" errors)

DROP POLICY IF EXISTS "Fallback user can manage goals" ON goals;
DROP POLICY IF EXISTS "Fallback user can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Fallback user can manage time_slots" ON time_slots;
DROP POLICY IF EXISTS "Fallback user can manage productivity_logs" ON productivity_logs;
DROP POLICY IF EXISTS "Fallback user can manage sleep_wake_logs" ON sleep_wake_logs;
DROP POLICY IF EXISTS "Fallback user can manage timeline_events" ON timeline_events;

-- =================================================================
-- CREATE NEW RLS POLICIES FOR FALLBACK USER
-- =================================================================

-- The fallback user ID from your .env.local file:
-- NEXT_PUBLIC_USER_ID=2c32a446-1bbc-4294-8a29-3e4fef5649e6

-- Note: We cast user_id to TEXT for comparison to avoid type mismatch errors
-- This works whether user_id column is UUID or TEXT type

CREATE POLICY "Fallback user can manage goals" ON goals
  FOR ALL 
  USING (user_id::text = '2c32a446-1bbc-4294-8a29-3e4fef5649e6');

CREATE POLICY "Fallback user can manage tasks" ON tasks
  FOR ALL 
  USING (user_id::text = '2c32a446-1bbc-4294-8a29-3e4fef5649e6');

CREATE POLICY "Fallback user can manage time_slots" ON time_slots
  FOR ALL 
  USING (user_id::text = '2c32a446-1bbc-4294-8a29-3e4fef5649e6');

CREATE POLICY "Fallback user can manage productivity_logs" ON productivity_logs
  FOR ALL 
  USING (user_id::text = '2c32a446-1bbc-4294-8a29-3e4fef5649e6');

CREATE POLICY "Fallback user can manage sleep_wake_logs" ON sleep_wake_logs
  FOR ALL 
  USING (user_id::text = '2c32a446-1bbc-4294-8a29-3e4fef5649e6');

CREATE POLICY "Fallback user can manage timeline_events" ON timeline_events
  FOR ALL 
  USING (user_id::text = '2c32a446-1bbc-4294-8a29-3e4fef5649e6');

-- =================================================================
-- VERIFICATION
-- =================================================================

-- List all RLS policies for verification
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%Fallback%'
ORDER BY tablename, policyname;

-- =================================================================
-- SUCCESS MESSAGE
-- =================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ RLS policies created successfully!';
  RAISE NOTICE 'You should now be able to save goals and tasks.';
END $$;
