-- ================================================================
-- Spendix Stabilization Migration — 2026-06-08
-- Fixes schema gaps identified in the architecture audit.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).
-- ================================================================

-- ── 1. Extend transactions.source to include goal_contribution ───
-- Goal contributions create expense transactions to track cash flow
-- correctly in the unified ledger.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN (
    'manual',
    'investment',
    'debt',
    'debt_payment',
    'work',
    'work_payment',
    'subscription',
    'recurring',
    'goal_contribution'
  ));

-- ── 2. Missing performance indexes ──────────────────────────────

-- Transactions: most common filter patterns
CREATE INDEX IF NOT EXISTS idx_tx_user_date
  ON public.transactions(user_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_tx_user_type
  ON public.transactions(user_id, type);

CREATE INDEX IF NOT EXISTS idx_tx_source
  ON public.transactions(source)
  WHERE source IS NOT NULL;

-- Goals: lookup by user + status
CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON public.goals(user_id, status)
  WHERE status IS NOT NULL;

-- Debts: lookup by user + status + type
CREATE INDEX IF NOT EXISTS idx_debts_user_type
  ON public.debts(user_id, debt_type);

CREATE INDEX IF NOT EXISTS idx_debts_user_status
  ON public.debts(user_id, status);

-- Debt payments: lookup by debt_id
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt
  ON public.debt_payments(debt_id);

CREATE INDEX IF NOT EXISTS idx_debt_payments_user
  ON public.debt_payments(user_id);

-- Work sessions: lookup by user + status
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_status
  ON public.work_sessions(user_id, status)
  WHERE status IS NOT NULL;

-- Subscriptions: active subscriptions for a user
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions(user_id, status);

-- Notifications: unread lookup
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, is_read)
  WHERE is_read = false;

-- ── 3. Ensure RLS is enabled on all core tables ──────────────────
ALTER TABLE public.transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts       ENABLE ROW LEVEL SECURITY;

-- ── 4. Ensure debt_payments has RLS ─────────────────────────────
ALTER TABLE IF EXISTS public.debt_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'debt_payments'
      AND policyname = 'debt_payments_own'
  ) THEN
    CREATE POLICY "debt_payments_own" ON public.debt_payments
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 5. Ensure work_payments has RLS ─────────────────────────────
ALTER TABLE IF EXISTS public.work_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'work_payments'
      AND policyname = 'work_payments_own'
  ) THEN
    CREATE POLICY "work_payments_own" ON public.work_payments
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. goals: ensure saved_amount has a non-negative constraint ──
ALTER TABLE public.goals
  ADD CONSTRAINT IF NOT EXISTS goals_saved_amount_non_negative
  CHECK (saved_amount >= 0);

ALTER TABLE public.goals
  ADD CONSTRAINT IF NOT EXISTS goals_target_amount_positive
  CHECK (target_amount >= 0);

-- ── 7. transactions: amount must be positive ─────────────────────
ALTER TABLE public.transactions
  ADD CONSTRAINT IF NOT EXISTS transactions_amount_positive
  CHECK (amount > 0);
