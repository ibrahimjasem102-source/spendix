-- =========================================
-- Work: add due_date + fix transaction source
-- File: 20260602_work_due_date.sql
-- =========================================

-- Optional payment due date on work sessions
alter table public.work_sessions
  add column if not exists due_date date;

create index if not exists idx_work_sessions_due_date
  on public.work_sessions(due_date)
  where due_date is not null;

-- Allow 'work' as a standalone source value (distinct from 'work_payment')
-- 'work' already exists in the constraint from 006_work.sql, nothing to add.
