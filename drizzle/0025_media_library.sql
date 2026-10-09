-- UR Leather media library table.
-- Safe to run more than once; does not alter or delete existing records.
CREATE TABLE IF NOT EXISTS public.media (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
