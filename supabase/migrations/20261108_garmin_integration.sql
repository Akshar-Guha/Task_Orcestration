-- Garmin Connect (Health API) integration
-- Tokens are only read/written server-side with the service role key,
-- so RLS is enabled with no policies (the anon key cannot read them).

-- One row per linked Garmin account
CREATE TABLE IF NOT EXISTS garmin_connections (
    user_id                  UUID PRIMARY KEY,
    garmin_user_id           TEXT UNIQUE,
    access_token             TEXT NOT NULL,
    refresh_token            TEXT NOT NULL,
    access_token_expires_at  TIMESTAMPTZ NOT NULL,
    refresh_token_expires_at TIMESTAMPTZ,
    scope                    TEXT,
    permissions              TEXT[],
    connected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_data_at             TIMESTAMPTZ
);

ALTER TABLE garmin_connections ENABLE ROW LEVEL SECURITY;

-- Short-lived PKCE state for the OAuth round trip
CREATE TABLE IF NOT EXISTS garmin_oauth_states (
    state          TEXT PRIMARY KEY,
    user_id        UUID NOT NULL,
    code_verifier  TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE garmin_oauth_states ENABLE ROW LEVEL SECURITY;

-- Every summary Garmin sends (dailies, sleeps, hrv, stressDetails, epochs,
-- activities, pulseox, allDayRespiration, userMetrics, bodyComps, ...).
-- The full payload is kept in `data` so no metric is lost.
CREATE TABLE IF NOT EXISTS garmin_summaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    garmin_user_id  TEXT NOT NULL,
    summary_type    TEXT NOT NULL,
    summary_id      TEXT NOT NULL,
    calendar_date   DATE,
    start_time      TIMESTAMPTZ,
    duration_seconds INTEGER,
    data            JSONB NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_garmin_summaries_type_id
    ON garmin_summaries(summary_type, summary_id);

CREATE INDEX IF NOT EXISTS idx_garmin_summaries_user_type_date
    ON garmin_summaries(user_id, summary_type, calendar_date DESC);

ALTER TABLE garmin_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fallback user can read garmin_summaries" ON garmin_summaries
    FOR SELECT USING (user_id = '2c32a446-1bbc-4294-8a29-3e4fef5649e6'::uuid);
