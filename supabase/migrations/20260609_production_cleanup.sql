-- ================================================================
-- Spendix Production Cleanup — 2026-06-09
-- ================================================================
-- Rules: No table drops. No data loss. No recreation of existing
-- tables. All operations are idempotent (IF NOT EXISTS / DO $$).
-- ================================================================


-- ── 1. Fix broken indexes from 20260608_stabilization.sql ───────────────────
-- Three indexes reference columns that do not exist on their tables.

-- notifications: the column is 'status' (values: unread/read/archived), not 'is_read'
DROP INDEX IF EXISTS public.idx_notifications_user_read;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE status = 'unread';

-- work_sessions: there is no 'status' column on this table
DROP INDEX IF EXISTS public.idx_work_sessions_user_status;
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_date
  ON public.work_sessions(user_id, work_date DESC);

-- goals: there is no 'status' column; active goals are those where completed_at IS NULL
DROP INDEX IF EXISTS public.idx_goals_user_status;
CREATE INDEX IF NOT EXISTS idx_goals_user_active
  ON public.goals(user_id, due_date)
  WHERE completed_at IS NULL;


-- ── 2. Fix invalid constraint syntax from 20260608_stabilization.sql ────────
-- 'ADD CONSTRAINT IF NOT EXISTS' is not valid PostgreSQL syntax before PG 15.
-- Re-apply as DO-guarded blocks so they are safe to re-run on any version.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.goals'::regclass
      AND conname  = 'goals_saved_amount_non_negative'
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_saved_amount_non_negative CHECK (saved_amount >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.goals'::regclass
      AND conname  = 'goals_target_amount_positive'
  ) THEN
    ALTER TABLE public.goals
      ADD CONSTRAINT goals_target_amount_positive CHECK (target_amount >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname  = 'transactions_amount_positive'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);
  END IF;
END $$;


-- ── 3. Fix RLS: stabilization tried to enable RLS on 'contacts' (wrong name) ──
-- The actual table is 'financial_contacts'.
ALTER TABLE IF EXISTS public.financial_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'financial_contacts'
      AND policyname = 'financial_contacts_all'
  ) THEN
    CREATE POLICY "financial_contacts_all" ON public.financial_contacts
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ── 4. Add updated_at column + trigger to budgets ───────────────────────────
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ── 5. Add updated_at column + trigger to debt_payments ─────────────────────
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_debt_payments_updated_at ON public.debt_payments;
CREATE TRIGGER trg_debt_payments_updated_at
  BEFORE UPDATE ON public.debt_payments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ── 6. Add updated_at column + trigger to work_payments ─────────────────────
ALTER TABLE public.work_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_work_payments_updated_at ON public.work_payments;
CREATE TRIGGER trg_work_payments_updated_at
  BEFORE UPDATE ON public.work_payments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ── 7. Add updated_at column + trigger to profiles ──────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ── 8. Add missing indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_budgets_user
  ON public.budgets(user_id);

CREATE INDEX IF NOT EXISTS idx_budgets_category
  ON public.budgets(category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goals_linked_debt
  ON public.goals(linked_debt_id)
  WHERE linked_debt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_payments_tx
  ON public.work_payments(transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_debt_payments_tx
  ON public.debt_payments(transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tx_related_source
  ON public.transactions(related_source_id)
  WHERE related_source_id IS NOT NULL;


-- ── 9. Add RLS DELETE policy to profiles ────────────────────────────────────
-- profiles only had SELECT / INSERT / UPDATE; DELETE was missing.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_delete'
  ) THEN
    CREATE POLICY "profiles_delete" ON public.profiles
      FOR DELETE USING (auth.uid() = id);
  END IF;
END $$;


-- ── 10. Fix goals updated_at trigger ────────────────────────────────────────
-- The goals migration tried to call 'update_updated_at_column()' which may not
-- exist. Replace with the standard set_updated_at() used by all other tables.
DROP TRIGGER IF EXISTS goals_updated_at     ON public.goals;
DROP TRIGGER IF EXISTS trg_goals_updated_at ON public.goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ── 11. Create goal_contributions table ─────────────────────────────────────
-- Tracks individual contributions to a goal. Transactions with
-- source='goal_contribution' link back here via transaction_id.
CREATE TABLE IF NOT EXISTS public.goal_contributions (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  goal_id        UUID          NOT NULL REFERENCES public.goals(id)       ON DELETE CASCADE,
  transaction_id UUID          REFERENCES public.transactions(id)         ON DELETE SET NULL,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  contributed_at DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_user ON public.goal_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON public.goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_tx
  ON public.goal_contributions(transaction_id)
  WHERE transaction_id IS NOT NULL;

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'goal_contributions'
      AND policyname = 'goal_contributions_all'
  ) THEN
    CREATE POLICY "goal_contributions_all" ON public.goal_contributions
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ── 12. Create user_plans table (billing tier / Stripe) ─────────────────────
-- IMPORTANT: This is NOT the same as public.subscriptions.
-- public.subscriptions = user-facing recurring bills (Netflix, Gym, etc.)
-- public.user_plans    = billing tier for Spendix itself (free/plus/pro/elite + Stripe)
CREATE TABLE IF NOT EXISTS public.user_plans (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                   TEXT        NOT NULL DEFAULT 'free'
                                     CHECK (plan IN ('free','plus','pro','elite')),
  status                 TEXT        NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active','trialing','canceled','past_due','incomplete')),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id        TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_plans_user ON public.user_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_stripe
  ON public.user_plans(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_plans'
      AND policyname = 'user_plans_select'
  ) THEN
    CREATE POLICY "user_plans_select" ON public.user_plans
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_plans_updated_at ON public.user_plans;
CREATE TRIGGER trg_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ── 13. Fix upsert_free_subscription() → target user_plans ─────────────────
-- The 20260606_subscriptions.sql migration defined this function but targeted
-- the user-facing subscriptions table (wrong schema — a NO-OP since the table
-- already existed with a completely different schema). Now targets user_plans.
CREATE OR REPLACE FUNCTION public.upsert_free_subscription(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan, status)
  VALUES (p_user_id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;


DO $$ BEGIN
  RAISE NOTICE '✓ 20260609_production_cleanup applied';
  RAISE NOTICE '  [1] Fixed 3 broken indexes (notifications/work_sessions/goals)';
  RAISE NOTICE '  [2] Fixed 3 invalid ADD CONSTRAINT IF NOT EXISTS blocks';
  RAISE NOTICE '  [3] Fixed RLS on financial_contacts (was erroneously targeting contacts)';
  RAISE NOTICE '  [4-7] Added updated_at column + trigger to budgets, debt_payments, work_payments, profiles';
  RAISE NOTICE '  [8] Added 6 missing indexes';
  RAISE NOTICE '  [9] Added DELETE policy to profiles';
  RAISE NOTICE '  [10] Fixed goals updated_at trigger → set_updated_at()';
  RAISE NOTICE '  [11] Created goal_contributions table with RLS + indexes';
  RAISE NOTICE '  [12] Created user_plans table (billing tier) with RLS + Stripe columns';
  RAISE NOTICE '  [13] Updated upsert_free_subscription() → targets user_plans';
END $$;
