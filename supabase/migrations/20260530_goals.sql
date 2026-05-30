-- Financial Goals
-- tracking_type: manual | savings | income | investment | debt_payoff

CREATE TABLE IF NOT EXISTS goals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  target_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  saved_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,     -- only used for 'manual' tracking
  monthly_contribution NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_date             DATE,
  category             TEXT NOT NULL DEFAULT 'other',
  tracking_type        TEXT NOT NULL DEFAULT 'manual',
  linked_debt_id       UUID REFERENCES debts(id) ON DELETE SET NULL,
  start_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  notes                TEXT,
  color                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goals_category_check
    CHECK (category IN ('emergency','home','travel','education','car','retirement','other')),
  CONSTRAINT goals_tracking_check
    CHECK (tracking_type IN ('manual','savings','income','investment','debt_payoff'))
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals"
  ON goals FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Re-use existing trigger function from other tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE 'CREATE TRIGGER goals_updated_at
      BEFORE UPDATE ON goals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_due_date ON goals(due_date);
