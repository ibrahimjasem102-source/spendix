-- =========================================
-- Notifications System
-- File: 007_notifications.sql
-- =========================================

create table if not exists public.notifications (
  id                uuid         primary key default uuid_generate_v4(),
  user_id           uuid         not null references auth.users(id) on delete cascade,

  title             text         not null,
  message           text         not null,

  type              text         not null default 'info'
    check (type in ('info','success','warning','error',
                    'reminder','debt','budget','work','investment','ai')),

  status            text         not null default 'unread'
    check (status in ('unread','read','archived')),

  priority          text         not null default 'normal'
    check (priority in ('low','normal','high')),

  source            text         not null default 'system'
    check (source in ('manual','transaction','debt','debt_payment',
                      'investment','work','budget','ai','system')),

  related_source_id uuid,
  action_url        text,
  metadata          jsonb        not null default '{}'::jsonb,

  -- scheduled_for: if set, notification is only visible after this time
  scheduled_for     timestamptz,
  read_at           timestamptz,

  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

-- Indexes
create index if not exists idx_notifications_user       on public.notifications(user_id);
create index if not exists idx_notifications_status     on public.notifications(status);
create index if not exists idx_notifications_type       on public.notifications(type);
create index if not exists idx_notifications_created    on public.notifications(created_at desc);
create index if not exists idx_notifications_scheduled  on public.notifications(scheduled_for)
  where scheduled_for is not null;

-- RLS
alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications_insert" on public.notifications
  for insert with check (auth.uid() = user_id);

create policy "notifications_update" on public.notifications
  for update using (auth.uid() = user_id);

create policy "notifications_delete" on public.notifications
  for delete using (auth.uid() = user_id);

-- Trigger: updated_at
create trigger trg_notifications_updated_at
  before update on public.notifications
  for each row execute procedure public.set_updated_at();

-- Enable Realtime for this table
-- (run in Supabase dashboard → Database → Replication → add notifications table)
