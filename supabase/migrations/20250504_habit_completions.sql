CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Real habit completion history — replaces fake streak dots
CREATE TABLE IF NOT EXISTS habit_completions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    habit_id     UUID NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    skipped      BOOLEAN NOT NULL DEFAULT FALSE,
    nudge_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    nudge_type   TEXT
);

CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date
    ON habit_completions(habit_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date
    ON habit_completions(user_id, completed_at DESC);

ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fallback user can manage habit_completions" ON habit_completions
    FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
