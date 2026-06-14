-- ================================================================
-- Ledger Schema — Production-Safe Upgrade — 2026-06-09
-- ================================================================
-- The ledger_entries table already exists (001_initial.sql) with a
-- minimal double-entry skeleton. This migration promotes it to the
-- full Unified Ledger schema without dropping any existing data.
-- ================================================================

-- ── 1. Relax legacy NOT NULL constraint on 'account' ────────────
-- Old column was NOT NULL but never had meaningful values.
ALTER TABLE public.ledger_entries ALTER COLUMN account DROP NOT NULL;
ALTER TABLE public.ledger_entries ALTER COLUMN account SET DEFAULT '';

-- ── 2. Add all new columns ───────────────────────────────────────
ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS source_module TEXT,       -- originating module: transaction | investment | debt_payment | work_payment | goal_contribution | subscription | bill | transfer
  ADD COLUMN IF NOT EXISTS source_id     UUID,       -- PK of the source module record
  ADD COLUMN IF NOT EXISTS direction     TEXT
    CHECK (direction IN ('inflow', 'outflow', 'neutral')),
  ADD COLUMN IF NOT EXISTS account_id    UUID
    REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id  UUID
    REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id   UUID,        -- soft FK to financial_contacts (no cascade needed)
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW();

-- ── 3. Add CHECK constraint on entry_type ───────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ledger_entries'::regclass
      AND conname  = 'ledger_entries_entry_type_check'
  ) THEN
    ALTER TABLE public.ledger_entries
      ADD CONSTRAINT ledger_entries_entry_type_check
      CHECK (entry_type IN (
        'income', 'expense',
        'investment',
        'debt_payment',
        'work_payment',
        'goal_contribution',
        'subscription_payment',
        'bill_payment',
        'transfer'
      ));
  END IF;
END $$;

-- ── 4. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ledger_user
  ON public.ledger_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_ledger_user_date
  ON public.ledger_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_source_module
  ON public.ledger_entries(source_module, source_id);

CREATE INDEX IF NOT EXISTS idx_ledger_direction
  ON public.ledger_entries(user_id, direction)
  WHERE direction IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_account
  ON public.ledger_entries(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_category
  ON public.ledger_entries(category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_transaction
  ON public.ledger_entries(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ── 5. RLS ───────────────────────────────────────────────────────
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ledger_entries'
      AND policyname = 'ledger_entries_all'
  ) THEN
    CREATE POLICY "ledger_entries_all" ON public.ledger_entries
      FOR ALL
      USING  (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. updated_at trigger ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_ledger_entries_updated_at ON public.ledger_entries;
CREATE TRIGGER trg_ledger_entries_updated_at
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DO $$ BEGIN
  RAISE NOTICE '✓ 20260609_ledger_schema: ledger_entries promoted to full Unified Ledger schema';
END $$;
