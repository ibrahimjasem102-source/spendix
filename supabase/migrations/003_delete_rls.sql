-- =========================================
-- Explicit DELETE RLS policies
-- File: 003_delete_rls.sql
-- Depends on: 001_initial.sql
--
-- 001_initial.sql uses "for all" which covers DELETE, but adding
-- explicit per-operation policies provides clearer audit trail
-- and prevents accidental policy changes from breaking delete.
-- =========================================

-- Drop the broad "for all" policy on transactions and replace
-- with granular per-operation policies.

drop policy if exists "Users manage own transactions" on public.transactions;

create policy "transactions_select"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete"
  on public.transactions for delete
  using (auth.uid() = user_id);


-- Same for categories
drop policy if exists "Users manage own categories" on public.categories;

create policy "categories_select"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "categories_insert"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories_update"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories_delete"
  on public.categories for delete
  using (auth.uid() = user_id);
