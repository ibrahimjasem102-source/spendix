-- ── Phase 8: Financial Contacts + Family Architecture ────────────────

-- 1. Extend contact type options (keep legacy types for existing data)
ALTER TABLE financial_contacts
  DROP CONSTRAINT IF EXISTS financial_contacts_type_check;

ALTER TABLE financial_contacts
  ADD CONSTRAINT financial_contacts_type_check
  CHECK (type IN ('person', 'company', 'bank', 'other', 'family', 'friend', 'client', 'employer'));

-- 2. Family members table (personal records, separate from household)
CREATE TABLE IF NOT EXISTS family_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL CHECK (char_length(name) > 0),
  relationship text        NOT NULL DEFAULT 'other',
  birth_date   date,
  notes        text,
  avatar_color text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own family members"
  ON family_members FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_family_members_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_family_members_updated_at ON family_members;
CREATE TRIGGER trg_family_members_updated_at
  BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION update_family_members_updated_at();

-- 3. Add contact_id to work_sessions for direct contact linking
ALTER TABLE work_sessions
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES financial_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_sessions_contact_id ON work_sessions(contact_id);
