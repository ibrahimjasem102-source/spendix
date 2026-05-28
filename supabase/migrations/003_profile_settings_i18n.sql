-- =========================================
-- Spendix Profile Settings and I18n
-- =========================================

create table if not exists public.profile_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'ar'
    check (language in ('ar', 'en', 'de')),
  currency text not null default 'EUR',
  theme text not null default 'dark'
    check (theme in ('dark', 'light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_settings enable row level security;

create policy "Users can view own profile settings"
on public.profile_settings
for select
using (auth.uid() = user_id);

create policy "Users can insert own profile settings"
on public.profile_settings
for insert
with check (auth.uid() = user_id);

create policy "Users can update own profile settings"
on public.profile_settings
for update
using (auth.uid() = user_id);

drop trigger if exists trg_profile_settings_updated_at
on public.profile_settings;

create trigger trg_profile_settings_updated_at
before update on public.profile_settings
for each row
execute procedure public.set_updated_at();

insert into public.profile_settings (user_id, currency)
select id, coalesce(currency, 'EUR')
from public.profiles
on conflict (user_id) do nothing;

create or replace function public.handle_new_user_settings()
returns trigger as $$
begin
  insert into public.profile_settings (
    user_id,
    language,
    currency,
    theme
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'language', 'ar'),
    coalesce(new.raw_user_meta_data->>'currency', 'EUR'),
    coalesce(new.raw_user_meta_data->>'theme', 'dark')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_settings_created
on auth.users;

create trigger on_auth_user_settings_created
after insert on auth.users
for each row
execute procedure public.handle_new_user_settings();
