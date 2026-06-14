-- ================================================================
-- Phase 13 — Growth, Enterprise & Ecosystem
-- Invoices, Projects, Automation, Organizations, Open Banking
-- ================================================================

-- ── 1. Projects ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id    UUID        REFERENCES public.financial_contacts(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  description   TEXT,
  status        TEXT        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','completed','paused','cancelled')),
  hourly_rate   NUMERIC(14,2),
  budget        NUMERIC(14,2),
  currency      TEXT        NOT NULL DEFAULT 'USD',
  start_date    DATE,
  end_date      DATE,
  color         TEXT        DEFAULT '#06B6D4',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user   ON public.projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_contact ON public.projects(contact_id) WHERE contact_id IS NOT NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='projects_own') THEN
    CREATE POLICY "projects_own" ON public.projects FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. Invoices ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id    UUID        REFERENCES public.financial_contacts(id) ON DELETE SET NULL,
  project_id    UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  number        TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent','viewed','paid','overdue','cancelled')),
  issue_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date      DATE,
  subtotal      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tax_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency      TEXT        NOT NULL DEFAULT 'USD',
  notes         TEXT,
  terms         TEXT,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description   TEXT        NOT NULL,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total         NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order    INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoices_user   ON public.invoices(user_id, status, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON public.invoices(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items    ON public.invoice_items(invoice_id);

ALTER TABLE public.invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='invoices_own') THEN
    CREATE POLICY "invoices_own" ON public.invoices FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_items' AND policyname='invoice_items_own') THEN
    CREATE POLICY "invoice_items_own" ON public.invoice_items FOR ALL
      USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));
  END IF;
END $$;

-- ── 3. Automation Rules ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  trigger_type     TEXT        NOT NULL
                   CHECK (trigger_type IN (
                     'on_transaction','on_salary','on_budget_exceeded',
                     'on_balance_low','on_debt_paid','on_goal_reached','schedule'
                   )),
  trigger_config   JSONB       NOT NULL DEFAULT '{}',
  action_type      TEXT        NOT NULL
                   CHECK (action_type IN (
                     'notify','allocate_to_goal','create_transaction','send_webhook'
                   )),
  action_config    JSONB       NOT NULL DEFAULT '{}',
  last_triggered_at TIMESTAMPTZ,
  trigger_count    INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id             BIGSERIAL   PRIMARY KEY,
  rule_id        UUID        NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_data   JSONB,
  action_result  JSONB,
  success        BOOLEAN     NOT NULL DEFAULT TRUE,
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS idx_automation_user   ON public.automation_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_automation_trigger ON public.automation_rules(trigger_type, is_active);
CREATE INDEX IF NOT EXISTS idx_automation_logs    ON public.automation_logs(rule_id, triggered_at DESC);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='automation_rules' AND policyname='automation_own') THEN
    CREATE POLICY "automation_own" ON public.automation_rules FOR ALL USING (auth.uid() = user_id);
    CREATE POLICY "automation_logs_own" ON public.automation_logs FOR ALL
      USING (EXISTS (SELECT 1 FROM public.automation_rules r WHERE r.id = rule_id AND r.user_id = auth.uid()));
  END IF;
END $$;

-- ── 4. Organizations (Enterprise) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  plan          TEXT        NOT NULL DEFAULT 'free',
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings      JSONB       NOT NULL DEFAULT '{}',
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.org_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','admin','member','viewer')),
  invited_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id        UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   TEXT,
  changes       JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orgs_owner     ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_org_members    ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON public.audit_logs(resource_type, resource_id, created_at DESC);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='organizations' AND policyname='org_owner') THEN
    CREATE POLICY "org_owner" ON public.organizations FOR ALL USING (auth.uid() = owner_id);
    CREATE POLICY "org_members_own" ON public.org_members FOR ALL
      USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()
      ));
  END IF;
END $$;

-- ── 5. Open Banking (Future-Ready) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.bank_connections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider              TEXT        NOT NULL CHECK (provider IN ('plaid','tink','mono','salt_edge','custom')),
  institution_id        TEXT,
  institution_name      TEXT,
  -- NEVER store raw access tokens — always use a secrets manager or encrypt at application level
  access_token_ref      TEXT,
  status                TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','error','disconnected','expired')),
  last_synced_at        TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  scopes                TEXT[],
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user ON public.bank_connections(user_id, status);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bank_connections' AND policyname='bank_own') THEN
    CREATE POLICY "bank_own" ON public.bank_connections FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. app_mode column for profile_settings ──────────────────

ALTER TABLE public.profile_settings
  ADD COLUMN IF NOT EXISTS app_mode TEXT NOT NULL DEFAULT 'personal'
  CHECK (app_mode IN ('personal','business','freelancer','family'));

RAISE NOTICE '✓ 20260609_phase13: projects, invoices, invoice_items, automation_rules, automation_logs, organizations, org_members, audit_logs, bank_connections applied';
