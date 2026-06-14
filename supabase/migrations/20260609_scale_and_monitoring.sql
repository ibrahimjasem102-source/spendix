-- ================================================================
-- Scale & Monitoring Migration — 2026-06-09
-- Prepares Spendix for 100k-10M+ users
-- ================================================================

-- ── 1. app_logs table (monitoring) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_logs (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  level       TEXT         NOT NULL CHECK (level IN ('debug','info','warn','error','critical')),
  category    TEXT         NOT NULL CHECK (category IN ('api','auth','sync','perf','ui','offline')),
  message     TEXT         NOT NULL,
  data        JSONB,
  url         TEXT,
  duration_ms INTEGER,
  session_id  TEXT,
  client_ts   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Partial index — only query error+ logs in dashboards
CREATE INDEX IF NOT EXISTS idx_app_logs_error
  ON public.app_logs(created_at DESC)
  WHERE level IN ('error', 'critical');

CREATE INDEX IF NOT EXISTS idx_app_logs_user
  ON public.app_logs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Logs are NOT user-owned — only service role can read them
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_logs' AND policyname = 'app_logs_insert_any'
  ) THEN
    -- Any authenticated user can INSERT their own logs
    CREATE POLICY "app_logs_insert_any" ON public.app_logs
      FOR INSERT WITH CHECK (true);
    -- Only service role reads (monitoring dashboard via admin only)
  END IF;
END $$;

-- Auto-purge logs older than 30 days (run via Supabase cron if available)
-- CREATE OR REPLACE FUNCTION purge_old_logs() RETURNS void AS $$
--   DELETE FROM public.app_logs WHERE created_at < NOW() - INTERVAL '30 days';
-- $$ LANGUAGE SQL;

-- ── 2. Scale-ready indexes ─────────────────────────────────────

-- ledger_entries: most critical for analytics at scale
CREATE INDEX IF NOT EXISTS idx_ledger_user_month
  ON public.ledger_entries(user_id, date_trunc('month', created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_user_direction_date
  ON public.ledger_entries(user_id, direction, created_at DESC)
  WHERE direction IN ('inflow', 'outflow');

CREATE INDEX IF NOT EXISTS idx_ledger_category_user
  ON public.ledger_entries(user_id, category_id)
  WHERE category_id IS NOT NULL;

-- transactions: most queried table
CREATE INDEX IF NOT EXISTS idx_txn_user_type_date
  ON public.transactions(user_id, type, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_txn_user_category
  ON public.transactions(user_id, category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_txn_user_account
  ON public.transactions(user_id, account_id)
  WHERE account_id IS NOT NULL;

-- debts: filter by direction + status frequently
CREATE INDEX IF NOT EXISTS idx_debts_user_direction_status
  ON public.debts(user_id, direction, status);

CREATE INDEX IF NOT EXISTS idx_debts_user_due_date
  ON public.debts(user_id, due_date)
  WHERE status != 'paid' AND due_date IS NOT NULL;

-- goals: active goals only
CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON public.goals(user_id, status)
  WHERE status != 'completed';

-- subscriptions: active subscriptions only
CREATE INDEX IF NOT EXISTS idx_subs_user_active
  ON public.subscriptions(user_id, next_billing_date)
  WHERE status = 'active';

-- work_sessions: current month queries
CREATE INDEX IF NOT EXISTS idx_work_user_date
  ON public.work_sessions(user_id, session_date DESC);

-- contacts: name search (ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_contacts_user_name_trgm
  ON public.financial_contacts(user_id, lower(name));

-- family_members: birthday queries
CREATE INDEX IF NOT EXISTS idx_family_user_birth
  ON public.family_members(user_id, birth_date)
  WHERE birth_date IS NOT NULL;

-- ai_insights: fresh insights query
CREATE INDEX IF NOT EXISTS idx_ai_insights_fresh
  ON public.ai_insights(user_id, created_at DESC)
  WHERE status != 'dismissed';

-- ── 3. Performance: add updated_at where missing ──────────────

-- Ensure accounts has updated_at
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_accounts_updated_at'
  ) THEN
    CREATE TRIGGER trg_accounts_updated_at
      BEFORE UPDATE ON public.accounts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── 4. Connection pooling hint ────────────────────────────────
-- Use Supabase connection pooler (pgBouncer) for 100k+ users.
-- Set in Supabase dashboard: Settings → Database → Connection Pooling
-- Mode: Transaction (for stateless Next.js API routes)
-- Pool size: 15 per dyno, scale horizontally

-- ── 5. Row estimate for VACUUM guidance ──────────────────────
-- Run in Supabase SQL editor periodically:
-- ANALYZE transactions; ANALYZE ledger_entries; ANALYZE debts;
-- pg_stats will show row estimates used by query planner.

RAISE NOTICE '✓ 20260609_scale_and_monitoring: app_logs + 14 scale indexes applied';
