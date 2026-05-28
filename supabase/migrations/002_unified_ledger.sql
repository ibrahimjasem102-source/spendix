-- =========================================
-- Unified Ledger System
-- File: 002_unified_ledger.sql
-- Depends on: 001_initial.sql
-- =========================================

create table if not exists public.unified_ledger_entries (
  id                uuid        primary key default uuid_generate_v4(),
  user_id           uuid        not null references auth.users(id) on delete cascade,

  type              text        not null check (type in (
    'transaction', 'income', 'investment',
    'debt', 'repayment', 'budget_alert', 'ai_insight'
  )),

  title             text        not null,
  amount            numeric(12, 2) not null check (amount >= 0),
  direction         text        not null check (direction in ('inflow', 'outflow', 'neutral')),

  category          text,
  category_color    text,
  related_module_id text,

  date              date        not null default current_date,
  metadata          jsonb       default '{}'::jsonb,

  created_at        timestamptz not null default now()
);

-- Indexes
create index if not exists idx_ledger_user_id   on public.unified_ledger_entries(user_id);
create index if not exists idx_ledger_type       on public.unified_ledger_entries(type);
create index if not exists idx_ledger_direction  on public.unified_ledger_entries(direction);
create index if not exists idx_ledger_date       on public.unified_ledger_entries(date desc);

-- RLS
alter table public.unified_ledger_entries enable row level security;

create policy "Users manage own ledger entries"
  on public.unified_ledger_entries for all
  using (auth.uid() = user_id);

-- =========================================
-- Auto-sync trigger: transactions → ledger
-- =========================================
create or replace function public.sync_transaction_to_ledger()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.unified_ledger_entries (
      user_id, type, title, amount, direction,
      related_module_id, date, metadata
    ) values (
      new.user_id,
      case when new.type = 'income' then 'income' else 'transaction' end,
      new.title,
      new.amount,
      case when new.type = 'income' then 'inflow' else 'outflow' end,
      new.id::text,
      new.transaction_date,
      jsonb_build_object('notes', new.notes, 'category_id', new.category_id)
    );
  elsif (TG_OP = 'DELETE') then
    delete from public.unified_ledger_entries
      where related_module_id = old.id::text
        and type in ('transaction', 'income');
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_transaction_to_ledger on public.transactions;
create trigger trg_sync_transaction_to_ledger
  after insert or delete on public.transactions
  for each row execute procedure public.sync_transaction_to_ledger();

-- =========================================
-- Materialized view: per-user balance cache
-- =========================================
create materialized view if not exists public.ledger_balances as
select
  user_id,
  sum(case when direction = 'inflow'  then amount else 0 end) as total_inflow,
  sum(case when direction = 'outflow' then amount else 0 end) as total_outflow,
  sum(case when direction = 'inflow'  then amount
           when direction = 'outflow' then -amount
           else 0 end)                                        as net_balance
from public.unified_ledger_entries
group by user_id;

create unique index if not exists idx_ledger_balances_user
  on public.ledger_balances(user_id);
