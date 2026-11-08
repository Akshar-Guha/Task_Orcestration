-- Health pipeline (PLAN.md B1): one processed row per day, raw webhook log,
-- watch quick-captures, and source tracking on sleep logs.

CREATE TABLE IF NOT EXISTS health_day (
    user_id               UUID NOT NULL,
    date                  DATE NOT NULL,

    -- Sleep (night that ENDS on `date`)
    sleep_start           TIMESTAMPTZ,
    sleep_end             TIMESTAMPTZ,
    sleep_minutes         INTEGER,
    deep_minutes          INTEGER,
    light_minutes         INTEGER,
    rem_minutes           INTEGER,
    awake_minutes         INTEGER,
    sleep_score           INTEGER,
    sleep_midpoint_min    INTEGER,          -- minutes after local midnight (can be negative / >1440 never)

    -- Overnight physiology
    hrv_night             REAL,
    rhr                   REAL,
    resp_night            REAL,
    spo2_avg              REAL,

    -- Day activity / stress
    steps                 INTEGER,
    step_goal             INTEGER,
    active_kcal           INTEGER,
    intensity_minutes     INTEGER,
    stress_avg            REAL,
    stress_max            REAL,
    high_stress_minutes   INTEGER,
    bb_high               INTEGER,
    bb_low                INTEGER,
    bb_charged            INTEGER,
    bb_drained            INTEGER,
    bb_at_wake            INTEGER,
    vo2max                REAL,
    max_hr_observed       REAL,
    late_activity         BOOLEAN,          -- workout ending after 20:00 local

    -- Derived scores
    training_load         REAL,             -- TRIMP-style daily load
    strain                REAL,             -- 0–21
    ctl                   REAL,             -- fitness (42-day EWMA)
    atl                   REAL,             -- fatigue (7-day EWMA)
    tsb                   REAL,             -- form = ctl - atl
    sleep_need_minutes    INTEGER,
    sleep_debt_minutes    INTEGER,
    sleep_consistency     INTEGER,          -- 0–100
    recovery              INTEGER,          -- 0–100
    readiness             INTEGER,          -- 0–100
    capacity_hours        REAL,             -- suggested focused-work hours
    illness_score         REAL,
    illness_flag          BOOLEAN DEFAULT FALSE,
    burnout_index         INTEGER,          -- 0–100
    energy_windows        JSONB,            -- {peak1:[from,to], dip:[..], peak2:[..], bedtime:"HH:MM"}
    session_advice        TEXT,
    insights              JSONB,            -- [{id, priority, title, body}]
    baseline_days         INTEGER,          -- how many days of history the scores used

    sources               JSONB,            -- which feeds contributed
    computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

ALTER TABLE health_day ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fallback user can read health_day" ON health_day;
CREATE POLICY "Fallback user can read health_day" ON health_day
    FOR SELECT USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

-- Raw webhook bodies for replay / debugging (service role only)
CREATE TABLE IF NOT EXISTS garmin_webhook_log (
    id           BIGSERIAL PRIMARY KEY,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload      JSONB NOT NULL,
    result       JSONB
);
ALTER TABLE garmin_webhook_log ENABLE ROW LEVEL SECURITY;

-- Quick captures from the watch ("idea", "low energy", ...) with physiology
CREATE TABLE IF NOT EXISTS watch_captures (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind       TEXT NOT NULL,
    hr         REAL,
    stress     REAL,
    body_battery REAL,
    note       TEXT
);
CREATE INDEX IF NOT EXISTS idx_watch_captures_user_ts ON watch_captures(user_id, ts DESC);
ALTER TABLE watch_captures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fallback user can read watch_captures" ON watch_captures;
CREATE POLICY "Fallback user can read watch_captures" ON watch_captures
    FOR SELECT USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

-- Sleep log provenance: 'manual' | 'garmin' | 'manual_override'
ALTER TABLE sleep_wake_logs ADD COLUMN IF NOT EXISTS sleep_source TEXT;
ALTER TABLE sleep_wake_logs ADD COLUMN IF NOT EXISTS wake_source  TEXT;

-- Watch task actions use snoozes
ALTER TABLE daily_task_status ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE daily_task_status ADD COLUMN IF NOT EXISTS skipped_reason TEXT;
ALTER TABLE daily_task_status ADD COLUMN IF NOT EXISTS source TEXT;

-- Pre-existing drift: the app writes this column but the live table lacked it
ALTER TABLE sleep_wake_logs ADD COLUMN IF NOT EXISTS wake_up_confirmed_at TIMESTAMPTZ;
ALTER TABLE sleep_wake_logs ADD COLUMN IF NOT EXISTS notes TEXT;
