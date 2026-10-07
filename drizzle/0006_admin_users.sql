CREATE TABLE IF NOT EXISTS public.admin_users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'manager',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_users_role_idx ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON public.admin_users(active);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
