-- Add milestones (phases) support to goals
ALTER TABLE goals ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]'::jsonb;
