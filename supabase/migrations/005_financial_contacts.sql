-- =========================================
-- Financial Contacts System
-- File: 005_financial_contacts.sql
-- Scope: contacts linked to debts only
-- =========================================

-- ── financial_contacts ────────────────────────────────────────
create table if not exists public.financial_contacts (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  type       text not null default 'person'
    check (type in ('person', 'company', 'bank', 'other')),
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contacts_user on public.financial_contacts(user_id);

alter table public.financial_contacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_contacts'
      and policyname = 'contacts_select'
  ) then
    create policy "contacts_select" on public.financial_contacts
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_contacts'
      and policyname = 'contacts_insert'
  ) then
    create policy "contacts_insert" on public.financial_contacts
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_contacts'
      and policyname = 'contacts_update'
  ) then
    create policy "contacts_update" on public.financial_contacts
      for update using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_contacts'
      and policyname = 'contacts_delete'
  ) then
    create policy "contacts_delete" on public.financial_contacts
      for delete using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_contacts_updated_at'
  ) then
    create trigger trg_contacts_updated_at
      before update on public.financial_contacts
      for each row execute procedure public.set_updated_at();
  end if;
end $$;

-- ── contact_id on debts ───────────────────────────────────────
-- Nullable FK; person_or_entity remains as fallback
alter table public.debts
  add column if not exists contact_id uuid
    references public.financial_contacts(id) on delete set null;

create index if not exists idx_debts_contact on public.debts(contact_id);

-- ── contact_id on transactions ────────────────────────────────
-- Only populated for source='debt' or source='debt_payment'
alter table public.transactions
  add column if not exists contact_id uuid
    references public.financial_contacts(id) on delete set null;

create index if not exists idx_tx_contact on public.transactions(contact_id);
