-- ================================================================
-- Spendix Subscriptions & Plans
-- ================================================================

create table if not exists public.subscriptions (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  plan                  text not null default 'free'
                          check (plan in ('free', 'plus', 'pro', 'elite')),
  status                text not null default 'active'
                          check (status in ('active', 'trialing', 'canceled', 'past_due', 'incomplete')),
  stripe_customer_id    text,
  stripe_subscription_id text,
  stripe_price_id       text,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (user_id)
);

create index if not exists idx_subscriptions_user    on public.subscriptions(user_id);
create index if not exists idx_subscriptions_stripe  on public.subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.subscriptions enable row level security;

-- Users can read their own subscription
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions'
    and policyname = 'subscriptions_select'
  ) then
    create policy "subscriptions_select" on public.subscriptions
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- Only service role can insert/update (done via API routes with service key or anon via RPC)
-- We expose an RPC so the bootstrap can create the row
create or replace function public.upsert_free_subscription(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (p_user_id, 'free', 'active')
  on conflict (user_id) do nothing;
end;
$$;

-- Trigger: keep updated_at fresh
create or replace trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
