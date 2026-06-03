-- ── Households (shared financial groups) ──────────────────────
CREATE TABLE IF NOT EXISTS public.households (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text        NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 60),
  created_by uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Members ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

-- ── Invitations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.household_invitations (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  role         text        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token        text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, email)
);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.households           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

-- Helper: is the given user a member of the given household?
CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = p_user_id
  );
$$;

-- Households
CREATE POLICY "households_select" ON public.households FOR SELECT
  USING (created_by = auth.uid() OR public.is_household_member(id, auth.uid()));
CREATE POLICY "households_insert" ON public.households FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "households_update" ON public.households FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "households_delete" ON public.households FOR DELETE
  USING (created_by = auth.uid());

-- Members
CREATE POLICY "members_select" ON public.household_members FOR SELECT
  USING (public.is_household_member(household_id, auth.uid()));
CREATE POLICY "members_delete" ON public.household_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_members.household_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'owner'
    )
  );

-- Invitations
CREATE POLICY "invitations_select" ON public.household_invitations FOR SELECT
  USING (
    invited_by = auth.uid()
    OR public.is_household_member(household_id, auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );
CREATE POLICY "invitations_insert" ON public.household_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND public.is_household_member(household_id, auth.uid())
  );
CREATE POLICY "invitations_delete" ON public.household_invitations FOR DELETE
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_invitations.household_id
        AND hm.user_id = auth.uid()
        AND hm.role IN ('owner', 'admin')
    )
  );

-- ── RPC: financial summary per household member ────────────────
-- Returns one row per member with their monthly income/expenses
-- and all-time net balance.  Uses SECURITY DEFINER so it can
-- read other members' transactions after verifying membership.
CREATE OR REPLACE FUNCTION public.get_household_summary(p_household_id uuid)
RETURNS TABLE (
  member_user_id   uuid,
  member_email     text,
  monthly_income   numeric,
  monthly_expenses numeric,
  net_balance      numeric,
  transaction_count bigint,
  member_role      text,
  joined_at        timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_month text := to_char(now(), 'YYYY-MM');
BEGIN
  IF NOT public.is_household_member(p_household_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    hm.user_id,
    au.email::text,
    COALESCE(SUM(
      CASE WHEN t.type = 'income'
           AND to_char(t.transaction_date::date, 'YYYY-MM') = v_month
      THEN t.amount ELSE 0 END
    ), 0)::numeric,
    COALESCE(SUM(
      CASE WHEN t.type = 'expense'
           AND to_char(t.transaction_date::date, 'YYYY-MM') = v_month
      THEN t.amount ELSE 0 END
    ), 0)::numeric,
    COALESCE(SUM(
      CASE WHEN t.type = 'income'  THEN  t.amount
           WHEN t.type = 'expense' THEN -t.amount
           ELSE 0 END
    ), 0)::numeric,
    COUNT(t.id),
    hm.role,
    hm.joined_at
  FROM public.household_members hm
  JOIN auth.users au ON au.id = hm.user_id
  LEFT JOIN public.transactions t ON t.user_id = hm.user_id
  WHERE hm.household_id = p_household_id
  GROUP BY hm.user_id, au.email, hm.role, hm.joined_at;
END;
$$;
