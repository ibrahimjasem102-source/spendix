-- Performance indexes for the high-traffic Spendix views.
-- These do not change auth, RLS, or table shape; they only help filtered reads.

create index if not exists idx_transactions_user_id
  on public.transactions (user_id);

create index if not exists idx_transactions_user_date
  on public.transactions (user_id, transaction_date desc);

create index if not exists idx_transactions_user_source
  on public.transactions (user_id, source);

create index if not exists idx_debts_user_status
  on public.debts (user_id, status);

create index if not exists idx_notifications_user_status
  on public.notifications (user_id, status);

create index if not exists idx_investments_user_id
  on public.investments (user_id);

create index if not exists idx_work_payments_user_id
  on public.work_payments (user_id);
