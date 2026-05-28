-- AI Insights table
create table if not exists public.ai_insights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null check (category in ('savings','spending','debt','investment','income','cashflow','risk','goal')),
  severity     text not null check (severity in ('critical','warning','positive','info')),
  title        text not null,
  body         text not null,
  action       text,
  action_url   text,
  confidence   numeric(4,3) not null default 0.7 check (confidence between 0 and 1),
  status       text not null default 'new' check (status in ('new','read','dismissed','acted')),
  metadata     jsonb,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Row-level security
alter table public.ai_insights enable row level security;

create policy "Users manage own insights"
  on public.ai_insights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast per-user queries
create index if not exists ai_insights_user_created
  on public.ai_insights(user_id, created_at desc);
