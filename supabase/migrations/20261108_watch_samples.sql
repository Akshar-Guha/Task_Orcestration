-- Data sent directly from the Garmin watch app (garmin-watch/)
-- Time series: heart rate, stress, Body Battery, SpO2
CREATE TABLE IF NOT EXISTS watch_samples (
    user_id   UUID NOT NULL,
    metric    TEXT NOT NULL,            -- hr | stress | bodyBattery | spo2
    ts        TIMESTAMPTZ NOT NULL,
    value     REAL NOT NULL,
    device    TEXT,
    PRIMARY KEY (user_id, metric, ts)
);

CREATE INDEX IF NOT EXISTS idx_watch_samples_metric_ts
    ON watch_samples(user_id, metric, ts DESC);

ALTER TABLE watch_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fallback user can read watch_samples" ON watch_samples
    FOR SELECT USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);

-- Daily totals so far (latest value wins)
CREATE TABLE IF NOT EXISTS watch_daily (
    user_id           UUID NOT NULL,
    date              DATE NOT NULL,
    steps             INTEGER,
    step_goal         INTEGER,
    calories          INTEGER,
    distance_m        REAL,
    active_minutes    INTEGER,
    floors_climbed    INTEGER,
    respiration_rate  REAL,
    time_to_recovery_h INTEGER,
    device            TEXT,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

ALTER TABLE watch_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fallback user can read watch_daily" ON watch_daily
    FOR SELECT USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
