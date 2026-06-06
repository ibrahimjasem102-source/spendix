-- Add current_period_start column to subscriptions table
alter table public.subscriptions
  add column if not exists current_period_start timestamptz;
