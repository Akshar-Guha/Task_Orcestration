-- Daily sensor data from device (step counter, active minutes)
-- One row per user per day — upserted from Android
CREATE TABLE IF NOT EXISTS sensor_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    steps           INTEGER NOT NULL DEFAULT 0,
    distance_meters FLOAT NOT NULL DEFAULT 0,
    active_minutes  INTEGER NOT NULL DEFAULT 0,
    source          TEXT NOT NULL DEFAULT 'step_counter',
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_sensor_logs_user_date
    ON sensor_logs(user_id, date);

ALTER TABLE sensor_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fallback user can manage sensor_logs" ON sensor_logs
    FOR ALL USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
