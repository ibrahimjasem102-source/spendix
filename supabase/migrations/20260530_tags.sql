-- ================================================================
-- Tags System
-- ================================================================

-- ── Tags ─────────────────────────────────────────────────────────
create table if not exists public.tags (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null check (char_length(name) >= 1 and char_length(name) <= 40),
  color      text        not null default '#06B6D4',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists idx_tags_user on public.tags(user_id);

alter table public.tags enable row level security;
create policy "tags_all" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Transaction ↔ Tag junction ───────────────────────────────────
create table if not exists public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id         uuid not null references public.tags(id)         on delete cascade,
  primary key (transaction_id, tag_id)
);

create index if not exists idx_transaction_tags_tx  on public.transaction_tags(transaction_id);
create index if not exists idx_transaction_tags_tag on public.transaction_tags(tag_id);

alter table public.transaction_tags enable row level security;
create policy "transaction_tags_all" on public.transaction_tags
  for all
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  );
