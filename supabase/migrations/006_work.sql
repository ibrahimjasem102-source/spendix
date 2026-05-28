-- =========================================
-- Work / العمل Module
-- File: 006_work.sql
-- =========================================

-- ── Extend transactions source ────────────────────────────────
-- Drop old check, add work + work_payment
alter table public.transactions
  drop constraint if exists transactions_source_check;

alter table public.transactions
  add constraint transactions_source_check
  check (source in (
    'manual', 'investment',
    'debt', 'debt_payment',
    'work', 'work_payment'
  ));

-- ── work_sessions ─────────────────────────────────────────────
create table if not exists public.work_sessions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  title               text not null,
  employer_or_client  text not null,
  hourly_rate         numeric(10,2) not null check (hourly_rate >= 0),
  hours_worked        numeric(8,2)  not null check (hours_worked >= 0),
  expected_amount     numeric(12,2) generated always as (hourly_rate * hours_worked) stored,

  work_date           date not null default current_date,
  notes               text,

  -- recurrence
  recurrence          text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  recurrence_end_date date,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_work_sessions_user   on public.work_sessions(user_id);
create index if not exists idx_work_sessions_date   on public.work_sessions(work_date desc);
create index if not exists idx_work_sessions_client on public.work_sessions(employer_or_client);

alter table public.work_sessions enable row level security;

create policy "work_sessions_all" on public.work_sessions
  for all using (auth.uid() = user_id);

create trigger trg_work_sessions_updated_at
  before update on public.work_sessions
  for each row execute procedure public.set_updated_at();

-- ── work_payments ─────────────────────────────────────────────
create table if not exists public.work_payments (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  work_session_id     uuid references public.work_sessions(id) on delete set null,

  employer_or_client  text not null,
  amount              numeric(12,2) not null check (amount > 0),
  payment_date        date not null default current_date,
  notes               text,

  -- linked transaction (income in unified ledger)
  transaction_id      uuid references public.transactions(id) on delete set null,

  created_at          timestamptz default now()
);

create index if not exists idx_work_payments_user    on public.work_payments(user_id);
create index if not exists idx_work_payments_session on public.work_payments(work_session_id);

alter table public.work_payments enable row level security;

create policy "work_payments_all" on public.work_payments
  for all using (auth.uid() = user_id);
