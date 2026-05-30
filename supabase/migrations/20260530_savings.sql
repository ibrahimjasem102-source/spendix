-- ── Savings Pots ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_pots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'other',
  target_amount  NUMERIC(14,2),
  color          TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT savings_pots_category_check CHECK (
    category IN ('emergency','travel','car','home','education','retirement','other')
  )
);

-- ── Savings Transactions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  savings_pot_id UUID NOT NULL REFERENCES savings_pots(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'deposit',
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  note           TEXT,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT savings_tx_type_check CHECK (type IN ('deposit','withdraw'))
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS savings_pots_user_id_idx ON savings_pots(user_id);
CREATE INDEX IF NOT EXISTS savings_tx_pot_id_idx    ON savings_transactions(savings_pot_id);
CREATE INDEX IF NOT EXISTS savings_tx_user_id_idx   ON savings_transactions(user_id);
CREATE INDEX IF NOT EXISTS savings_tx_date_idx      ON savings_transactions(date DESC);

-- ── Updated-at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_savings_pots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS savings_pots_updated_at ON savings_pots;
CREATE TRIGGER savings_pots_updated_at
  BEFORE UPDATE ON savings_pots
  FOR EACH ROW EXECUTE FUNCTION update_savings_pots_updated_at();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE savings_pots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;

-- savings_pots
DROP POLICY IF EXISTS savings_pots_select ON savings_pots;
DROP POLICY IF EXISTS savings_pots_insert ON savings_pots;
DROP POLICY IF EXISTS savings_pots_update ON savings_pots;
DROP POLICY IF EXISTS savings_pots_delete ON savings_pots;

CREATE POLICY savings_pots_select ON savings_pots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY savings_pots_insert ON savings_pots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY savings_pots_update ON savings_pots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY savings_pots_delete ON savings_pots FOR DELETE USING (auth.uid() = user_id);

-- savings_transactions
DROP POLICY IF EXISTS savings_tx_select ON savings_transactions;
DROP POLICY IF EXISTS savings_tx_insert ON savings_transactions;
DROP POLICY IF EXISTS savings_tx_delete ON savings_transactions;

CREATE POLICY savings_tx_select ON savings_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY savings_tx_insert ON savings_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY savings_tx_delete ON savings_transactions FOR DELETE USING (auth.uid() = user_id);
