-- ================================================================
-- Accounts System — Production-Safe Upgrade — 2026-06-09
-- ================================================================
-- Rules: No table drops. No data loss. All operations idempotent.
-- ================================================================


-- ── 1. Add 'investment' account type ────────────────────────────────────────
-- The existing CHECK only allows: cash | bank | credit_card | wallet | savings
-- We need to add 'investment' for investment brokerage accounts.
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('cash','bank','credit_card','wallet','savings','investment'));


-- ── 2. Add 'transfer' to transactions.source CHECK ──────────────────────────
-- Transfer transactions are currently labelled source='manual', which means
-- they inflate income/expense summaries. Adding 'transfer' lets the engine
-- exclude them from income/expense calculations while keeping account balances
-- accurate (each leg still has type=income|expense for per-account balance).
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
    'goal_contribution',
    'transfer'
  ));


-- ── 3. Create a Default Cash account for users with unassigned transactions ─
-- Only created once per user, and only if they have orphaned transactions.
-- Uses a DO block to avoid INSERT errors on repeat runs.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT t.user_id
    FROM public.transactions t
    WHERE t.account_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.user_id = t.user_id
      )
  LOOP
    INSERT INTO public.accounts (user_id, name, type, currency, initial_balance, is_default)
    VALUES (r.user_id, 'Default Cash', 'cash', 'USD', 0, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;


-- ── 4. Assign orphaned transactions to the user's earliest account ──────────
-- For users who already have accounts, link any unassigned transactions to
-- their default account (or oldest account if no default exists).
UPDATE public.transactions t
SET account_id = (
  SELECT a.id
  FROM   public.accounts a
  WHERE  a.user_id = t.user_id
  ORDER  BY a.is_default DESC, a.created_at ASC
  LIMIT  1
)
WHERE t.account_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.user_id = t.user_id
  );


-- ── 5. Ledger entries: ensure account_id reference is intact ────────────────
-- The ledger_entries table has an account_id column (added in ledger_schema
-- migration). No structural change needed — writers already pass account_id.


-- ── 6. Backfill existing ledger_entries with account_id from their linked tx ─
UPDATE public.ledger_entries le
SET account_id = t.account_id
FROM public.transactions t
WHERE le.transaction_id = t.id
  AND le.account_id IS NULL
  AND t.account_id IS NOT NULL;


DO $$ BEGIN
  RAISE NOTICE '✓ 20260609_accounts_system applied';
  RAISE NOTICE '  [1] Added investment account type to CHECK constraint';
  RAISE NOTICE '  [2] Added transfer source to transactions CHECK constraint';
  RAISE NOTICE '  [3] Created Default Cash accounts for users with orphaned transactions';
  RAISE NOTICE '  [4] Assigned orphaned transactions to their user default account';
  RAISE NOTICE '  [6] Backfilled account_id on existing ledger_entries from linked transactions';
END $$;
