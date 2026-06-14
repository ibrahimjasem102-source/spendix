-- ================================================================
-- Phase 12 — Production Launch & Monetization
-- Referrals, Onboarding, Product Analytics, Support Tickets
-- ================================================================

-- ── 1. Referrals ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  code          TEXT        NOT NULL UNIQUE,
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rewarded','expired')),
  reward_until  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code     ON public.referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_id) WHERE referred_id IS NOT NULL;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referrals' AND policyname='referrals_own') THEN
    CREATE POLICY "referrals_own" ON public.referrals
      FOR ALL USING (auth.uid() = referrer_id);
  END IF;
END $$;

-- ── 2. Onboarding Progress ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_steps  TEXT[]      NOT NULL DEFAULT '{}',
  selected_currency TEXT,
  is_complete      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='onboarding_progress' AND policyname='onboarding_own') THEN
    CREATE POLICY "onboarding_own" ON public.onboarding_progress
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. Product Events (analytics) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_events (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name  TEXT        NOT NULL,
  properties  JSONB,
  session_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_events_event  ON public.product_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_user   ON public.product_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_events_date   ON public.product_events(date_trunc('day', created_at));

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_events' AND policyname='product_events_insert') THEN
    CREATE POLICY "product_events_insert" ON public.product_events
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ── 4. Support Tickets ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL CHECK (type IN ('feedback','bug','feature','support')),
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority    TEXT        NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  user_email  TEXT,
  app_version TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status  ON public.support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user    ON public.support_tickets(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_type    ON public.support_tickets(type, status);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_tickets' AND policyname='tickets_own') THEN
    CREATE POLICY "tickets_own" ON public.support_tickets
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_tickets' AND policyname='tickets_insert_any') THEN
    CREATE POLICY "tickets_insert_any" ON public.support_tickets
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ── 5. Stripe Price Audit Log ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id            TEXT        PRIMARY KEY,
  type          TEXT        NOT NULL,
  data          JSONB       NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON public.stripe_events(type, processed_at DESC);

-- No RLS — service role only via admin client

RAISE NOTICE '✓ 20260609_phase12: referrals, onboarding_progress, product_events, support_tickets, stripe_events';
