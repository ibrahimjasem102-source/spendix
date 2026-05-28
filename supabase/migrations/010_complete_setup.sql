-- ================================================================
-- Spendix — Complete Production Setup
-- Run this once in Supabase SQL Editor to set up everything.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).
-- ================================================================

-- ── 1. Extensions ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── 2. Utility: updated_at trigger ───────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ── 3. profile_settings ──────────────────────────────────────────
create table if not exists public.profile_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  language   text default 'ar',
  currency   text default 'EUR',
  theme      text default 'dark',
  full_name  text,
  updated_at timestamptz default now()
);
alter table public.profile_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='profile_settings' and policyname='profile_settings_all')
  then create policy "profile_settings_all" on public.profile_settings
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
-- Ensure full_name column exists
alter table public.profile_settings add column if not exists full_name text;

-- ── 4. categories ────────────────────────────────────────────────
create table if not exists public.categories (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('income','expense')),
  color      text default '#888888',
  icon       text,
  section    text default 'general'
             check (section in ('expense','income','investment','debt','work','general')),
  created_at timestamptz default now()
);
alter table public.categories add column if not exists icon    text;
alter table public.categories add column if not exists section text default 'general';
create index if not exists idx_categories_user on public.categories(user_id);
alter table public.categories enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='categories' and policyname='Users manage own categories')
  then create policy "Users manage own categories" on public.categories
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 5. transactions ───────────────────────────────────────────────
create table if not exists public.transactions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  category_id      uuid references public.categories(id) on delete set null,
  title            text not null,
  notes            text,
  amount           numeric(12,2) not null check (amount >= 0),
  type             text not null check (type in ('income','expense')),
  source           text not null default 'manual'
                   check (source in ('manual','investment','debt','debt_payment','work','work_payment')),
  related_source_id uuid,
  contact_id        uuid,
  transaction_date  date not null default current_date,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
alter table public.transactions add column if not exists source
  text not null default 'manual';
alter table public.transactions add column if not exists related_source_id uuid;
alter table public.transactions add column if not exists contact_id uuid;

-- Drop old source check, recreate with all values
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual','investment','debt','debt_payment','work','work_payment'));

create index if not exists idx_tx_user_date   on public.transactions(user_id, transaction_date desc);
create index if not exists idx_tx_user_source on public.transactions(user_id, source);
alter table public.transactions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='transactions' and policyname='Users manage own transactions')
  then create policy "Users manage own transactions" on public.transactions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at before update on public.transactions
  for each row execute procedure public.set_updated_at();

-- ── 6. budgets ────────────────────────────────────────────────────
create table if not exists public.budgets (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete cascade,
  monthly_limit numeric(12,2) not null,
  month         integer not null,
  year          integer not null,
  created_at    timestamptz default now()
);
alter table public.budgets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='budgets' and policyname='Users manage own budgets')
  then create policy "Users manage own budgets" on public.budgets
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 7. financial_contacts ─────────────────────────────────────────
create table if not exists public.financial_contacts (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  type       text not null default 'person'
             check (type in ('person','company','bank','other')),
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_contacts_user on public.financial_contacts(user_id);
alter table public.financial_contacts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='financial_contacts' and policyname='contacts_all')
  then create policy "contacts_all" on public.financial_contacts
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 8. investments ────────────────────────────────────────────────
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
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='investments' and policyname='investments_all')
  then create policy "investments_all" on public.investments
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
drop trigger if exists trg_investments_updated_at on public.investments;
create trigger trg_investments_updated_at before update on public.investments
  for each row execute procedure public.set_updated_at();

-- ── 9. debts ──────────────────────────────────────────────────────
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
  contact_id       uuid references public.financial_contacts(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table public.debts add column if not exists contact_id
  uuid references public.financial_contacts(id) on delete set null;
create index if not exists idx_debts_user_status on public.debts(user_id, status);
alter table public.debts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='debts' and policyname='debts_all')
  then create policy "debts_all" on public.debts
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
drop trigger if exists trg_debts_updated_at on public.debts;
create trigger trg_debts_updated_at before update on public.debts
  for each row execute procedure public.set_updated_at();

-- ── 10. debt_payments ─────────────────────────────────────────────
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
create index if not exists idx_debt_payments_debt on public.debt_payments(debt_id);
alter table public.debt_payments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='debt_payments' and policyname='debt_payments_all')
  then create policy "debt_payments_all" on public.debt_payments
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 11. work_sessions ─────────────────────────────────────────────
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
  recurrence          text not null default 'none'
                      check (recurrence in ('none','daily','weekly','monthly')),
  recurrence_end_date date,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists idx_work_sessions_user on public.work_sessions(user_id);
alter table public.work_sessions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='work_sessions' and policyname='work_sessions_all')
  then create policy "work_sessions_all" on public.work_sessions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
drop trigger if exists trg_work_sessions_updated_at on public.work_sessions;
create trigger trg_work_sessions_updated_at before update on public.work_sessions
  for each row execute procedure public.set_updated_at();

-- ── 12. work_payments ─────────────────────────────────────────────
create table if not exists public.work_payments (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  work_session_id     uuid references public.work_sessions(id) on delete set null,
  employer_or_client  text not null,
  amount              numeric(12,2) not null check (amount > 0),
  payment_date        date not null default current_date,
  notes               text,
  transaction_id      uuid references public.transactions(id) on delete set null,
  created_at          timestamptz default now()
);
create index if not exists idx_work_payments_user on public.work_payments(user_id);
alter table public.work_payments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='work_payments' and policyname='work_payments_all')
  then create policy "work_payments_all" on public.work_payments
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 13. notifications ─────────────────────────────────────────────
create table if not exists public.notifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  message           text not null,
  type              text not null default 'info'
                    check (type in ('info','success','warning','error',
                                    'reminder','debt','budget','work','investment','ai')),
  status            text not null default 'unread'
                    check (status in ('unread','read','archived')),
  priority          text not null default 'normal'
                    check (priority in ('low','normal','high')),
  source            text not null default 'system'
                    check (source in ('manual','transaction','debt','debt_payment',
                                      'investment','work','budget','ai','system')),
  related_source_id uuid,
  action_url        text,
  metadata          jsonb not null default '{}'::jsonb,
  scheduled_for     timestamptz,
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_notifications_user_status on public.notifications(user_id, status);
alter table public.notifications enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='notifications' and policyname='Users manage own notifications')
  then create policy "Users manage own notifications" on public.notifications
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at before update on public.notifications
  for each row execute procedure public.set_updated_at();

-- ── 14. ai_insights ───────────────────────────────────────────────
create table if not exists public.ai_insights (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  category   text not null check (category in
             ('savings','spending','debt','investment','income','cashflow','risk','goal')),
  severity   text not null check (severity in ('critical','warning','positive','info')),
  title      text not null,
  body       text not null,
  action     text,
  action_url text,
  confidence numeric(4,3) not null default 0.7 check (confidence between 0 and 1),
  status     text not null default 'new' check (status in ('new','read','dismissed','acted')),
  metadata   jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ai_insights_user on public.ai_insights(user_id, created_at desc);
alter table public.ai_insights enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='ai_insights' and policyname='Users manage own insights')
  then create policy "Users manage own insights" on public.ai_insights
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 15. Auto-create profile on signup ─────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profile_settings (user_id, language, currency, theme, full_name)
  values (
    new.id, 'ar', 'EUR', 'dark',
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 16. Auto-seed categories on signup ────────────────────────────
create or replace function public.seed_default_categories(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.categories (user_id, name, type, color, icon, section) values
  -- مصروفات
  (p_user_id,'طعام',         'expense','#EF4444','UtensilsCrossed','expense'),
  (p_user_id,'مواصلات',      'expense','#3B82F6','Car',            'expense'),
  (p_user_id,'تسوق',         'expense','#A855F7','ShoppingBag',    'expense'),
  (p_user_id,'فواتير',       'expense','#F97316','Receipt',        'expense'),
  (p_user_id,'صحة',          'expense','#EC4899','Heart',          'expense'),
  (p_user_id,'تعليم',        'expense','#8B5CF6','GraduationCap',  'expense'),
  (p_user_id,'اشتراكات',    'expense','#6366F1','Repeat',          'expense'),
  (p_user_id,'ترفيه',        'expense','#14B8A6','Gamepad2',       'expense'),
  (p_user_id,'ملابس',        'expense','#F43F5E','Shirt',          'expense'),
  (p_user_id,'منزل',         'expense','#0EA5E9','Home',           'expense'),
  (p_user_id,'أخرى - مصروف','expense','#6B7280','MoreHorizontal', 'expense'),
  -- دخل
  (p_user_id,'راتب',         'income', '#22C55E','Banknote',       'income'),
  (p_user_id,'عمل حر',       'income', '#10B981','Laptop',         'income'),
  (p_user_id,'هدية',         'income', '#F59E0B','Gift',           'income'),
  (p_user_id,'استرداد',      'income', '#06B6D4','RefreshCw',      'income'),
  (p_user_id,'أرباح',        'income', '#84CC16','TrendingUp',     'income'),
  (p_user_id,'أخرى - دخل',  'income', '#6B7280','MoreHorizontal', 'income'),
  -- استثمارات
  (p_user_id,'أسهم',         'expense','#6366F1','BarChart3',      'investment'),
  (p_user_id,'عملات رقمية',  'expense','#F59E0B','Coins',          'investment'),
  (p_user_id,'ETF',           'expense','#8B5CF6','TrendingUp',    'investment'),
  (p_user_id,'ذهب',           'expense','#EAB308','Gem',           'investment'),
  (p_user_id,'عقار',          'expense','#10B981','Building',      'investment'),
  -- ديون
  (p_user_id,'دين شخصي',    'expense','#EF4444','Users',          'debt'),
  (p_user_id,'بنك',           'expense','#3B82F6','Landmark',      'debt'),
  (p_user_id,'بطاقة ائتمان', 'expense','#F97316','CreditCard',    'debt'),
  (p_user_id,'قرض',           'expense','#DC2626','DollarSign',    'debt'),
  -- عمل
  (p_user_id,'دوام',          'income', '#06B6D4','Briefcase',     'work'),
  (p_user_id,'مشروع',         'income', '#8B5CF6','Package',       'work'),
  (p_user_id,'عميل',          'income', '#10B981','Users',         'work'),
  (p_user_id,'دفعة عمل',     'income', '#22C55E','Wallet',        'work');
end; $$;

-- Trigger: seed categories on new user signup
create or replace function public.handle_new_user_categories()
returns trigger language plpgsql security definer as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end; $$;

drop trigger if exists on_auth_user_categories on auth.users;
create trigger on_auth_user_categories
  after insert on auth.users
  for each row execute procedure public.handle_new_user_categories();

-- ── 17. Seed categories for EXISTING users (run once) ─────────────
-- This seeds categories for existing users who don't have any yet
do $$
declare r record;
begin
  for r in
    select id from auth.users
    where id not in (select distinct user_id from public.categories)
  loop
    perform public.seed_default_categories(r.id);
  end loop;
end $$;

-- ── 18. Final message ─────────────────────────────────────────────
do $$ begin
  raise notice '✓ Spendix database setup complete!';
  raise notice '  Tables: categories, transactions, debts, debt_payments,';
  raise notice '          investments, work_sessions, work_payments,';
  raise notice '          notifications, ai_insights, financial_contacts,';
  raise notice '          profile_settings, budgets';
  raise notice '  Triggers: auto-profile, auto-categories on signup';
  raise notice '  RLS: enabled on all tables';
end $$;
