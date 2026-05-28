-- =========================================
-- Spendix Initial Schema
-- Fixed Version
-- =========================================

create extension if not exists "uuid-ossp";

-- =========================================
-- PROFILES
-- =========================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  currency text default 'EUR',
  created_at timestamptz default now()
);

-- =========================================
-- CATEGORIES
-- =========================================

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  type text not null check (type in ('income', 'expense')),

  color text default '#888888',
  icon text,

  created_at timestamptz default now()
);

create index if not exists idx_categories_user_id
on public.categories(user_id);

-- =========================================
-- TRANSACTIONS
-- =========================================

create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid not null references auth.users(id) on delete cascade,

  category_id uuid references public.categories(id)
  on delete set null,

  title text not null,
  notes text,

  amount numeric(12,2) not null check (amount >= 0),

  type text not null check (
    type in ('income', 'expense')
  ),

  transaction_date date not null default current_date,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_transactions_user_id
on public.transactions(user_id);

-- =========================================
-- BUDGETS
-- =========================================

create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid not null references auth.users(id)
  on delete cascade,

  category_id uuid references public.categories(id)
  on delete cascade,

  monthly_limit numeric(12,2) not null,

  month integer not null,
  year integer not null,

  created_at timestamptz default now()
);

-- =========================================
-- AI INSIGHTS
-- =========================================

create table if not exists public.ai_insights (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid not null references auth.users(id)
  on delete cascade,

  insight_type text not null,

  title text not null,
  content text not null,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

-- =========================================
-- RECURRING RULES
-- =========================================

create table if not exists public.recurring_rules (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid not null references auth.users(id)
  on delete cascade,

  category_id uuid references public.categories(id)
  on delete set null,

  title text not null,

  amount numeric(12,2) not null,

  frequency text not null,

  next_run_date date not null,

  active boolean default true,

  created_at timestamptz default now()
);

-- =========================================
-- LEDGER ENTRIES
-- =========================================

create table if not exists public.ledger_entries (
  id uuid primary key default uuid_generate_v4(),

  user_id uuid not null references auth.users(id)
  on delete cascade,

  transaction_id uuid references public.transactions(id)
  on delete cascade,

  entry_type text not null,

  amount numeric(12,2) not null,

  account text not null,

  created_at timestamptz default now()
);

-- =========================================
-- UPDATED_AT TRIGGER
-- =========================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_transactions_updated_at
on public.transactions;

create trigger trg_transactions_updated_at
before update on public.transactions
for each row
execute procedure public.set_updated_at();

-- =========================================
-- ENABLE RLS
-- =========================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.ai_insights enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.ledger_entries enable row level security;

-- =========================================
-- RLS POLICIES
-- =========================================

-- PROFILES

drop policy if exists "Users can view own profile"
on public.profiles;

drop policy if exists "Users can insert own profile"
on public.profiles;

drop policy if exists "Users can update own profile"
on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

-- CATEGORIES

drop policy if exists "Users manage own categories"
on public.categories;

create policy "Users manage own categories"
on public.categories
for all
using (auth.uid() = user_id);

-- TRANSACTIONS

drop policy if exists "Users manage own transactions"
on public.transactions;

create policy "Users manage own transactions"
on public.transactions
for all
using (auth.uid() = user_id);

-- BUDGETS

drop policy if exists "Users manage own budgets"
on public.budgets;

create policy "Users manage own budgets"
on public.budgets
for all
using (auth.uid() = user_id);

-- AI INSIGHTS

drop policy if exists "Users manage own ai insights"
on public.ai_insights;

create policy "Users manage own ai insights"
on public.ai_insights
for all
using (auth.uid() = user_id);

-- RECURRING RULES

drop policy if exists "Users manage own recurring rules"
on public.recurring_rules;

create policy "Users manage own recurring rules"
on public.recurring_rules
for all
using (auth.uid() = user_id);

-- LEDGER ENTRIES

drop policy if exists "Users manage own ledger entries"
on public.ledger_entries;

create policy "Users manage own ledger entries"
on public.ledger_entries
for all
using (auth.uid() = user_id);

-- =========================================
-- DEFAULT CATEGORIES FUNCTION
-- =========================================

create or replace function public.create_default_categories()
returns trigger as $$
begin

  insert into public.categories (
    user_id,
    name,
    type,
    color
  )
  values
    (new.id, 'Food', 'expense', '#ef4444'),
    (new.id, 'Transport', 'expense', '#3b82f6'),
    (new.id, 'Shopping', 'expense', '#a855f7'),
    (new.id, 'Bills', 'expense', '#f97316'),
    (new.id, 'Salary', 'income', '#22c55e');

  return new;

end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.create_default_categories();

-- =========================================
-- AUTO CREATE PROFILE
-- =========================================

create or replace function public.handle_new_user()
returns trigger as $$
begin

  insert into public.profiles (
    id,
    full_name,
    currency
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'EUR'
  );

  return new;

end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_profile_created
on auth.users;

create trigger on_auth_user_profile_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();