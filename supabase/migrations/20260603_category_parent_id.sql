-- Add optional parent categories for one-level category organization.
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;

create index if not exists categories_parent_id
  on public.categories(user_id, parent_id);
