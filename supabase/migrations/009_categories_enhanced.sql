-- Enhance categories table with icon and section support
alter table public.categories
  add column if not exists icon    text,
  add column if not exists section text default 'general'
    check (section in ('expense','income','investment','debt','work','general'));

-- Index for faster filtering by section
create index if not exists categories_section
  on public.categories(user_id, section, type);
