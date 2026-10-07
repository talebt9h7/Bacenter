CREATE TABLE IF NOT EXISTS public.categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS categories_active_idx ON public.categories(active);
CREATE INDEX IF NOT EXISTS categories_sort_idx ON public.categories(sort_order);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

INSERT INTO public.categories (id, name, description, sort_order)
VALUES
('backpacks','Backpacks','Everyday and travel backpacks.',10),
('crossbody-bags','Crossbody Bags','Compact bags for everyday carry.',20),
('tote-bags','Tote Bags','Versatile totes for work and life.',30),
('work-bags','Work Bags','Work-ready bags and messengers.',40),
('luggage','Luggage','Travel luggage and carry-ons.',50),
('wallets','Wallets','Slim wallets and everyday essentials.',60),
('phone-cases','Phone Cases','Protective cases with considered design.',70),
('accessories','Accessories','Pouches, tech kits and useful extras.',80)
ON CONFLICT (id) DO NOTHING;
