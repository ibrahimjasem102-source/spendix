-- Phase 14: Platform Governance, Security & Reliability

-- ── Security Events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_events (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type  TEXT      NOT NULL CHECK (event_type IN (
    'login_failed','login_success','suspicious_request',
    'rate_limit_exceeded','token_abuse','api_abuse',
    'password_reset','email_change','subscription_change',
    'admin_action','gdpr_export','gdpr_delete','account_locked'
  )),
  severity    TEXT      NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  ip_address  TEXT,
  user_agent  TEXT,
  path        TEXT,
  metadata    JSONB     DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_events_user     ON security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_type     ON security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity, created_at DESC) WHERE severity IN ('high','critical');
CREATE INDEX idx_security_events_ip       ON security_events(ip_address, created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
-- Admin access only via service-role key — no user policies intentionally

-- ── User Permissions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permissions (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT      NOT NULL DEFAULT 'user' CHECK (role IN (
    'user','family_member','manager','admin','support_agent'
  )),
  granted_by  UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  metadata    JSONB     DEFAULT '{}'::jsonb,
  UNIQUE(user_id)
);

CREATE INDEX idx_user_permissions_role ON user_permissions(role);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_role" ON user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- ── GDPR Requests ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gdpr_requests (
  id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type  TEXT      NOT NULL CHECK (request_type IN ('export','delete','rectify')),
  status        TEXT      NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  payload       JSONB,
  expires_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gdpr_requests_user   ON gdpr_requests(user_id, created_at DESC);
CREATE INDEX idx_gdpr_requests_status ON gdpr_requests(status) WHERE status IN ('pending','processing');

ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_gdpr" ON gdpr_requests
  FOR ALL USING (auth.uid() = user_id);

-- ── Consent Settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_settings (
  user_id               UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  analytics_consent     BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent     BOOLEAN NOT NULL DEFAULT FALSE,
  crash_reporting       BOOLEAN NOT NULL DEFAULT TRUE,
  data_sharing          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_consent" ON consent_settings
  FOR ALL USING (auth.uid() = user_id);

-- ── Data Quality Reports ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_quality_reports (
  id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type    TEXT      NOT NULL,
  issues_found  INTEGER   NOT NULL DEFAULT 0,
  details       JSONB     DEFAULT '[]'::jsonb,
  run_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dq_reports_type ON data_quality_reports(check_type, run_at DESC);

-- DQ table is admin-only; no RLS user policies
ALTER TABLE data_quality_reports ENABLE ROW LEVEL SECURITY;

-- ── Frontend Error Log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS frontend_errors (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
  message     TEXT      NOT NULL,
  stack       TEXT,
  url         TEXT,
  metadata    JSONB     DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_frontend_errors_created ON frontend_errors(created_at DESC);

ALTER TABLE frontend_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_insert_own_errors" ON frontend_errors
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ── Default user_permissions for existing users ──────────────────────────────
INSERT INTO user_permissions (user_id, role)
  SELECT id, 'user' FROM auth.users
  ON CONFLICT (user_id) DO NOTHING;

-- Trigger: auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION assign_default_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION assign_default_role();
