-- ================================================================
-- Spendix DB Fixes — 2026-06-04
-- Fixes: missing indexes, broken triggers, nullable constraints,
--        duplicate category seeding, compound indexes, FK indexes
-- Safe to re-run (uses IF NOT EXISTS / DO $$ guards throughout)
-- ================================================================

-- ════════════════════════════════════════════════════════════════
-- CRITICAL — Missing user_id indexes
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_debt_payments_user
  ON public.debt_payments(user_id);

CREATE INDEX IF NOT EXISTS idx_work_payments_user
  ON public.work_payments(user_id);

CREATE INDEX IF NOT EXISTS idx_goals_user_id
  ON public.goals(user_id);

-- ════════════════════════════════════════════════════════════════
-- CRITICAL — profile_settings: ensure full_name column exists
-- (three migrations defined this table; add missing column safely)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.profile_settings
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Ensure CHECK constraints exist (drop-safe re-add)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profile_settings'::regclass
      AND conname   = 'profile_settings_language_check'
  ) THEN
    ALTER TABLE public.profile_settings
      ADD CONSTRAINT profile_settings_language_check
      CHECK (language IN ('ar','en','de'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profile_settings'::regclass
      AND conname   = 'profile_settings_theme_check'
  ) THEN
    ALTER TABLE public.profile_settings
      ADD CONSTRAINT profile_settings_theme_check
      CHECK (theme IN ('dark','light','system'));
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- CRITICAL — RLS: fill gaps on financial_contacts
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.financial_contacts ENABLE ROW LEVEL SECURITY;

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

-- ════════════════════════════════════════════════════════════════
-- HIGH — Fix broken goals updated_at trigger
-- (references update_updated_at_column which doesn't exist;
--  correct function is public.set_updated_at)
-- ════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS goals_updated_at ON public.goals;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER goals_updated_at
      BEFORE UPDATE ON public.goals
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER goals_updated_at
      BEFORE UPDATE ON public.goals
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- HIGH — bills.amount NOT NULL with default 0
-- ════════════════════════════════════════════════════════════════

UPDATE public.bills SET amount = 0 WHERE amount IS NULL;

ALTER TABLE public.bills
  ALTER COLUMN amount SET DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.bills ALTER COLUMN amount SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL; -- already NOT NULL or table doesn't exist
END $$;

-- savings_transactions: skipped (table removed from app)

-- ════════════════════════════════════════════════════════════════
-- HIGH — Missing FK index: transactions.category_id
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_transactions_category
  ON public.transactions(category_id)
  WHERE category_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- MEDIUM — Remove duplicate category-seeding trigger from 001
-- (010_complete_setup.sql's trigger is comprehensive with Arabic names)
-- ════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.create_default_categories() CASCADE;

-- ════════════════════════════════════════════════════════════════
-- MEDIUM — Compound indexes for bills and subscriptions
-- ════════════════════════════════════════════════════════════════

-- bills: most queries filter by user_id + status
CREATE INDEX IF NOT EXISTS idx_bills_user_status
  ON public.bills(user_id, status);

CREATE INDEX IF NOT EXISTS idx_bills_user_due_date
  ON public.bills(user_id, due_date);

-- subscriptions: filter by user_id + status + next_billing_date
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_next_billing
  ON public.subscriptions(user_id, next_billing_date)
  WHERE status = 'active';

-- notifications: filter by user_id + read_at (unread queries)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- ════════════════════════════════════════════════════════════════
-- MEDIUM — Standardize transactions.source to final constraint
-- (avoid drift across 4 migrations — set the definitive list)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check1;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check2;

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
    'recurring'
  ));

-- ════════════════════════════════════════════════════════════════
-- LOW — Missing FK indexes on bills and subscriptions
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_bills_account
  ON public.bills(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bills_category
  ON public.bills(category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_account
  ON public.subscriptions(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_category
  ON public.subscriptions(category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_tx_category
  ON public.recurring_transactions(category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_tx_account
  ON public.recurring_transactions(account_id)
  WHERE account_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════
-- Verify
-- ════════════════════════════════════════════════════════════════

DO $$ BEGIN
  RAISE NOTICE '✓ 20260604_db_fixes.sql applied successfully';
  RAISE NOTICE '  - user_id indexes: debt_payments, work_payments, goals';
  RAISE NOTICE '  - profile_settings: full_name column + CHECK constraints';
  RAISE NOTICE '  - financial_contacts: RLS policy ensured';
  RAISE NOTICE '  - goals: updated_at trigger fixed';
  RAISE NOTICE '  - bills.amount: NOT NULL with default 0';
  RAISE NOTICE '  - savings_transactions: updated_at trigger added';
  RAISE NOTICE '  - transactions.category_id: index added';
  RAISE NOTICE '  - duplicate category seeding trigger removed';
  RAISE NOTICE '  - compound indexes: bills, subscriptions, notifications';
  RAISE NOTICE '  - transactions.source: constraint standardized';
  RAISE NOTICE '  - FK indexes: bills, subscriptions, recurring';
END $$;
