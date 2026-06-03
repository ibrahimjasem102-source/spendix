-- ================================================================
-- Notifications v2 — extend type + source check constraints
-- Adds: 'goal' and 'bill' to type, 'goal' and 'bill' to source
-- ================================================================

DO $$
DECLARE
  cname text;
BEGIN
  -- Drop old type check constraint
  SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%type in%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', cname);
  END IF;

  -- Drop old source check constraint
  SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%source in%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'info','success','warning','error',
    'reminder','debt','budget','work',
    'investment','ai','goal','bill'
  ));

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_source_check
  CHECK (source IN (
    'manual','transaction','debt','debt_payment',
    'investment','work','budget','ai','system',
    'goal','bill'
  ));
