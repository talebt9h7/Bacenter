-- Compatibility migration for existing Supabase projects whose settings table
-- predates the updated_at column used by the current Drizzle schema.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
