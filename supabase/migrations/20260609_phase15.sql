-- Phase 15: Beta Launch & Real User Validation

-- ── Beta Invite Codes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beta_invites (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT      NOT NULL UNIQUE,
  label       TEXT,                                       -- e.g. "Batch 1 — Twitter"
  created_by  UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by     UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  max_uses    INTEGER   NOT NULL DEFAULT 1,
  use_count   INTEGER   NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_beta_invites_code    ON beta_invites(code);
CREATE INDEX idx_beta_invites_used_by ON beta_invites(used_by);

ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;
-- Admin-only via service-role key; no user-facing RLS policies

-- ── Real User Monitoring (RUM) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_samples (
  id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id      TEXT,
  page            TEXT      NOT NULL,
  metric          TEXT      NOT NULL CHECK (metric IN (
    'fcp','lcp','ttfb','dom_load','page_load','cls','fid','inp'
  )),
  value_ms        FLOAT     NOT NULL CHECK (value_ms >= 0),
  connection_type TEXT,
  device_category TEXT      CHECK (device_category IN ('desktop','tablet','mobile','unknown')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_perf_page   ON performance_samples(page,   created_at DESC);
CREATE INDEX idx_perf_metric ON performance_samples(metric, created_at DESC);
CREATE INDEX idx_perf_date   ON performance_samples(created_at DESC);

ALTER TABLE performance_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_perf" ON performance_samples
  FOR INSERT WITH CHECK (true);

-- ── In-app Ratings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_ratings (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  rating      SMALLINT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  context     TEXT,     -- page or feature the rating was submitted from
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_ratings_created ON app_ratings(created_at DESC);
CREATE INDEX idx_app_ratings_rating  ON app_ratings(rating);

ALTER TABLE app_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_insert_own_rating" ON app_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_read_own_ratings" ON app_ratings
  FOR SELECT USING (auth.uid() = user_id);

-- ── Beta User tracking view ──────────────────────────────────────────────────
-- Convenience: who is in the beta cohort?
CREATE OR REPLACE VIEW beta_users AS
  SELECT
    bi.used_by   AS user_id,
    bi.used_at   AS joined_beta_at,
    bi.code      AS invite_code,
    bi.label     AS invite_batch
  FROM beta_invites bi
  WHERE bi.used_by IS NOT NULL;
