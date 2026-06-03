-- ================================================================
-- Recurring Transactions
-- Allows users to set up automatic/template transactions that
-- repeat on a schedule (daily, weekly, monthly, yearly).
-- ================================================================

CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type                TEXT        NOT NULL CHECK (type IN ('income','expense')),
  category_id         UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id          UUID        REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes               TEXT,

  -- Recurrence
  frequency           TEXT        NOT NULL DEFAULT 'monthly'
                                  CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  interval_count      INTEGER     NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  start_date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  end_date            DATE,
  next_run_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  last_run_date       DATE,

  -- Status
  active              BOOLEAN     NOT NULL DEFAULT TRUE,
  auto_create         BOOLEAN     NOT NULL DEFAULT TRUE,  -- create transaction automatically

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_tx_user   ON public.recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_tx_next   ON public.recurring_transactions(next_run_date) WHERE active = TRUE;

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recurring_transactions' AND policyname = 'recurring_tx_all'
  ) THEN
    CREATE POLICY "recurring_tx_all" ON public.recurring_transactions
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_recurring_tx_updated_at ON public.recurring_transactions;
CREATE TRIGGER trg_recurring_tx_updated_at
  BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DO $$ BEGIN
  RAISE NOTICE '✓ recurring_transactions table created';
END $$;
