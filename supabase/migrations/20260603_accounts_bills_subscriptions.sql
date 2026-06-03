-- ================================================================
-- Accounts, Bills, and Subscriptions
-- Adds tables required by the app that have no prior migration.
-- Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ================================================================

-- ── 1. accounts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'bank'
                              CHECK (type IN ('cash','bank','credit_card','wallet','savings')),
  currency        TEXT        NOT NULL DEFAULT 'USD',
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  color           TEXT,
  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'accounts_all'
  ) THEN
    CREATE POLICY "accounts_all" ON public.accounts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── 2. Add account_id column to transactions (if missing) ─────────
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tx_account ON public.transactions(account_id) WHERE account_id IS NOT NULL;

-- ── 3. bills ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bills (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  amount              NUMERIC(14,2),
  currency            TEXT        NOT NULL DEFAULT 'USD',
  due_date            DATE        NOT NULL,
  category_id         UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id          UUID        REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_recurring        BOOLEAN     NOT NULL DEFAULT FALSE,
  recurrence          TEXT        CHECK (recurrence IN ('monthly','quarterly','yearly')),
  color               TEXT,
  icon                TEXT,
  notes               TEXT,
  status              TEXT        NOT NULL DEFAULT 'unpaid'
                                  CHECK (status IN ('unpaid','paid','overdue')),
  remind_days_before  INTEGER     NOT NULL DEFAULT 3,
  paid_at             TIMESTAMPTZ,
  transaction_id      UUID        REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_user     ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON public.bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_status   ON public.bills(user_id, status);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bills' AND policyname = 'bills_all'
  ) THEN
    CREATE POLICY "bills_all" ON public.bills
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_bills_updated_at ON public.bills;
CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── 4. subscriptions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    TEXT        NOT NULL,
  amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency                TEXT        NOT NULL DEFAULT 'USD',
  billing_cycle           TEXT        NOT NULL DEFAULT 'monthly'
                                      CHECK (billing_cycle IN ('weekly','monthly','quarterly','yearly')),
  next_billing_date       DATE        NOT NULL,
  category_id             UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id              UUID        REFERENCES public.accounts(id) ON DELETE SET NULL,
  color                   TEXT,
  icon                    TEXT,
  notes                   TEXT,
  status                  TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active','paused','cancelled')),
  remind_days_before      INTEGER     NOT NULL DEFAULT 3,
  auto_create_transaction BOOLEAN     NOT NULL DEFAULT TRUE,
  last_billed_date        DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user        ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing     ON public.subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_all'
  ) THEN
    CREATE POLICY "subscriptions_all" ON public.subscriptions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── 5. Extend transactions.source to allow 'subscription' ─────────
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual','investment','debt','debt_payment','work','work_payment','subscription'));

DO $$ BEGIN
  RAISE NOTICE '✓ accounts, bills, subscriptions tables created (or already exist)';
  RAISE NOTICE '  transactions.account_id column added (if missing)';
  RAISE NOTICE '  transactions.source constraint updated to include subscription';
END $$;
