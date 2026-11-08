-- Health-driven nudges (PLAN.md B4): log of nudges sent, used to dedupe
-- (at most one nudge per kind per 2h) by /api/cron/notifications.
CREATE TABLE IF NOT EXISTS health_nudges (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id  UUID NOT NULL,
    kind     TEXT NOT NULL,                 -- stress_break | low_battery | quiet_day
    sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload  JSONB
);

CREATE INDEX IF NOT EXISTS idx_health_nudges_user_kind_sent
    ON health_nudges(user_id, kind, sent_at DESC);

ALTER TABLE health_nudges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fallback user can read health_nudges" ON health_nudges;
CREATE POLICY "Fallback user can read health_nudges" ON health_nudges
    FOR SELECT USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
