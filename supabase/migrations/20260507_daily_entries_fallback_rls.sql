-- Add fallback RLS policy for daily_entries so the Android app (no auth session,
-- anon key) can read and write diary data for the known single user UUID.
-- Pattern: mirrors fallback policies in 20250117_fix_rls_policies.sql.

CREATE POLICY "Fallback user can manage daily_entries" ON daily_entries
    FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
