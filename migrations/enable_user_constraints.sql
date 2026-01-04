-- Migration: Clean up old data and enable user_id constraints
-- Execute this in Supabase SQL Editor when ready

-- Step 1: Update all existing NULL user_ids to the single user
-- Replace 'YOUR_USER_ID_HERE' with your actual auth.users UUID
UPDATE nodes SET user_id = 'YOUR_USER_ID_HERE' WHERE user_id IS NULL;
UPDATE memories SET user_id = 'YOUR_USER_ID_HERE' WHERE user_id IS NULL;
UPDATE daily_logs SET user_id = 'YOUR_USER_ID_HERE' WHERE user_id IS NULL;

-- Step 2: Re-enable NOT NULL constraints
ALTER TABLE nodes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE memories ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE daily_logs ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Add user_id to edges table for consistency
ALTER TABLE edges ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users;

-- Verification query
SELECT 
  'nodes' as table_name, 
  COUNT(*) as total_records,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as null_user_ids
FROM nodes
UNION ALL
SELECT 'memories', COUNT(*), COUNT(CASE WHEN user_id IS NULL THEN 1 END) FROM memories
UNION ALL  
SELECT 'daily_logs', COUNT(*), COUNT(CASE WHEN user_id IS NULL THEN 1 END) FROM daily_logs;
