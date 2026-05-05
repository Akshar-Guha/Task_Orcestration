-- ML dataset tables: readiness_scores + nudge_events
-- Fixes C1 (readiness never persisted) and C2 (nudge decisions lost)

-- Persisted daily readiness scores — primary ML label table
CREATE TABLE IF NOT EXISTS readiness_scores (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL,
    date              DATE NOT NULL,
    window_days       INTEGER NOT NULL DEFAULT 7,

    -- Composite score (0-100)
    readiness         INTEGER NOT NULL CHECK (readiness BETWEEN 0 AND 100),

    -- Sub-scores (0-100 each)
    sleep_score       INTEGER NOT NULL CHECK (sleep_score BETWEEN 0 AND 100),
    step_score        INTEGER NOT NULL CHECK (step_score BETWEEN 0 AND 100),
    habit_score       INTEGER NOT NULL CHECK (habit_score BETWEEN 0 AND 100),
    goal_score        INTEGER NOT NULL CHECK (goal_score BETWEEN 0 AND 100),

    -- Raw trend arrays (length = window_days)
    mood_trend        JSONB NOT NULL DEFAULT '[]'::jsonb,
    step_trend        JSONB NOT NULL DEFAULT '[]'::jsonb,
    sleep_trend_hours JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Scalar context
    total_goal_hours  FLOAT NOT NULL DEFAULT 0,
    steps_today       INTEGER NOT NULL DEFAULT 0,

    -- Lineage
    app_version       TEXT,
    computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_readiness_scores_user_date
    ON readiness_scores(user_id, date DESC);

ALTER TABLE readiness_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fallback user can manage readiness_scores" ON readiness_scores
    FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

-- Nudge evaluation log — every evaluation, fired or suppressed
-- Primary signal for intervention/personalization models
CREATE TABLE IF NOT EXISTS nudge_events (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL,
    evaluated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- What fired (null = no nudge triggered this evaluation)
    nudge_type            TEXT,
    nudge_title           TEXT,
    was_shown             BOOLEAN NOT NULL DEFAULT FALSE,

    -- Context snapshot at evaluation time
    ctx_steps_today       INTEGER NOT NULL DEFAULT 0,
    ctx_seven_day_avg     FLOAT NOT NULL DEFAULT 0,
    ctx_has_diary         BOOLEAN NOT NULL DEFAULT FALSE,
    ctx_habit_count       INTEGER NOT NULL DEFAULT 0,
    ctx_goal_count        INTEGER NOT NULL DEFAULT 0,

    -- Lineage
    app_version           TEXT
);

CREATE INDEX IF NOT EXISTS idx_nudge_events_user_date
    ON nudge_events(user_id, evaluated_at DESC);

ALTER TABLE nudge_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fallback user can manage nudge_events" ON nudge_events
    FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
