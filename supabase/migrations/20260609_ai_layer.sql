-- ================================================================
-- AI Layer — 2026-06-09
-- Creates ai_insights and ai_conversations tables
-- ================================================================

-- ── 1. ai_insights ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     TEXT         NOT NULL
    CHECK (category IN ('savings','spending','debt','investment','income','cashflow','risk','goal')),
  severity     TEXT         NOT NULL
    CHECK (severity IN ('critical','warning','positive','info')),
  title        TEXT         NOT NULL,
  body         TEXT         NOT NULL,
  action       TEXT,
  action_url   TEXT,
  confidence   NUMERIC(3,2) NOT NULL DEFAULT 0.8,
  status       TEXT         NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','read','dismissed','acted')),
  metadata     JSONB,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_ai_insights_updated_at ON public.ai_insights;
CREATE TRIGGER trg_ai_insights_updated_at
  BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id
  ON public.ai_insights(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user_status
  ON public.ai_insights(user_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at
  ON public.ai_insights(user_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_insights' AND policyname = 'ai_insights_owner'
  ) THEN
    CREATE POLICY "ai_insights_owner" ON public.ai_insights
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. ai_conversations ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id   UUID         NOT NULL DEFAULT uuid_generate_v4(),
  role         TEXT         NOT NULL CHECK (role IN ('user','assistant')),
  content      TEXT         NOT NULL,
  advisor_type TEXT,        -- null = general chat, or budget/debt/goals/subscriptions/investments
  tokens_used  INTEGER,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_user_session
  ON public.ai_conversations(user_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conv_user_recent
  ON public.ai_conversations(user_id, created_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_conversations' AND policyname = 'ai_conversations_owner'
  ) THEN
    CREATE POLICY "ai_conversations_owner" ON public.ai_conversations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. Auto-expire old insights (cleanup) ─────────────────────
-- Dismissed insights older than 30 days are dropped automatically
-- via Supabase cron or pg_cron if available. Migration just sets expires_at.
-- The application layer checks expires_at on reads.

RAISE NOTICE '✓ 20260609_ai_layer: ai_insights + ai_conversations ready';
