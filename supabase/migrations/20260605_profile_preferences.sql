-- Add preferences JSONB column to profile_settings
-- Stores notifications, AI settings, and other user preferences
ALTER TABLE public.profile_settings
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profile_settings_user
  ON public.profile_settings(user_id);
