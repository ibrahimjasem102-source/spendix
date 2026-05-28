-- =========================================
-- Investments, Debts, Debt Payments
-- + profile_settings + source on transactions
-- File: 004_investments_debts.sql
-- =========================================

-- ── profile_settings (used by i18n system) ───────────────────
create table if not exists public.profile_settings (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  language  text default 'ar',
  currency  text default 'EUR',
  theme     text default 'dark',
  updated_at timestamptz default now()
);
alter table public.profile_settings enable row level security;
create policy "profile_settings_all" on public.profile_settings
  for all using (auth.uid() = user_id);

-- ── source + related_source_id on transactions ───────────────
alter table public.transactions
  add column if not exists source text
    default 'manual'
    check (source in ('manual','investment','debt','debt_payment')),
  add column if not exists related_source_id uuid;

create index if not exists idx_tx_source on public.transactions(source);

-- ── investments ───────────────────────────────────────────────
create table if not exists public.investments (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  asset_name      text not null,
  asset_type      text not null default 'other'
    check (asset_type in ('stock','crypto','etf','real_estate','other')),
  amount_invested numeric(14,2) not null check (amount_invested > 0),
  current_value   numeric(14,2),
  investment_date date not null default current_date,
  notes           text,
  transaction_id  uuid references public.transactions(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_investments_user on public.investments(user_id);

alter table public.investments enable row level security;
create policy "investments_all" on public.investments
  for all using (auth.uid() = user_id);

create trigger trg_investments_updated_at
  before update on public.investments
  for each row execute procedure public.set_updated_at();

-- ── debts ─────────────────────────────────────────────────────
create table if not exists public.debts (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  person_or_entity text not null,
  debt_type        text not null check (debt_type in ('payable','receivable')),
  total_amount     numeric(14,2) not null check (total_amount > 0),
  paid_amount      numeric(14,2) not null default 0,
  due_date         date,
  status           text not null default 'active'
    check (status in ('active','partially_paid','paid','overdue')),
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_debts_user on public.debts(user_id);

alter table public.debts enable row level security;
create policy "debts_all" on public.debts
  for all using (auth.uid() = user_id);

create trigger trg_debts_updated_at
  before update on public.debts
  for each row execute procedure public.set_updated_at();

-- ── debt_payments ─────────────────────────────────────────────
create table if not exists public.debt_payments (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  debt_id        uuid not null references public.debts(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount         numeric(14,2) not null check (amount > 0),
  payment_date   date not null default current_date,
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists idx_debt_payments_user   on public.debt_payments(user_id);
create index if not exists idx_debt_payments_debt   on public.debt_payments(debt_id);

alter table public.debt_payments enable row level security;
create policy "debt_payments_all" on public.debt_payments
  for all using (auth.uid() = user_id);
