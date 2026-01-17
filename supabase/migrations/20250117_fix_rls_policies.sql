-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fix RLS policies to allow fallback user for single-user mode
-- This ensures data persists even when not authenticated
-- Note: user_id column is UUID type, so we cast the string literal to UUID

-- Allow all operations for the fallback user (single-user mode)
CREATE POLICY "Fallback user can manage goals" ON goals
  FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

CREATE POLICY "Fallback user can manage tasks" ON tasks
  FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

CREATE POLICY "Fallback user can manage time slots" ON time_slots
  FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

CREATE POLICY "Fallback user can manage productivity logs" ON productivity_logs
  FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

CREATE POLICY "Fallback user can manage sleep logs" ON sleep_wake_logs
  FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

CREATE POLICY "Fallback user can manage timeline events" ON timeline_events
  FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
