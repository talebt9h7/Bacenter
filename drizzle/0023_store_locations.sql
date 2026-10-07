CREATE TABLE IF NOT EXISTS store_locations (
  id serial PRIMARY KEY,
  name text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  address_ar text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  map_url text NOT NULL DEFAULT '',
  phone text,
  hours text NOT NULL DEFAULT '',
  hours_ar text NOT NULL DEFAULT '',
  image text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS store_locations_active_sort_idx ON store_locations (active, sort_order, id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM store_locations) THEN
    INSERT INTO store_locations (name, name_ar, description, description_ar, map_url, sort_order) VALUES
      ('Melbourne', 'ملبورن', 'Discover our stockists in and around Melbourne. Check current hours and availability before visiting.', 'اكتشف نقاط البيع في ملبورن وما حولها. تحقق من ساعات العمل والتوفر قبل الزيارة.', 'https://www.google.com/maps/search/Bellroy+stockists+Melbourne', 10),
      ('London', 'لندن', 'Discover our stockists in and around London. Check current hours and availability before visiting.', 'اكتشف نقاط البيع في لندن وما حولها. تحقق من ساعات العمل والتوفر قبل الزيارة.', 'https://www.google.com/maps/search/Bellroy+stockists+London', 20),
      ('New York', 'نيويورك', 'Discover our stockists in and around New York. Check current hours and availability before visiting.', 'اكتشف نقاط البيع في نيويورك وما حولها. تحقق من ساعات العمل والتوفر قبل الزيارة.', 'https://www.google.com/maps/search/Bellroy+stockists+New+York', 30),
      ('Sydney', 'سيدني', 'Discover our stockists in and around Sydney. Check current hours and availability before visiting.', 'اكتشف نقاط البيع في سيدني وما حولها. تحقق من ساعات العمل والتوفر قبل الزيارة.', 'https://www.google.com/maps/search/Bellroy+stockists+Sydney', 40),
      ('Singapore', 'سنغافورة', 'Discover our stockists in and around Singapore. Check current hours and availability before visiting.', 'اكتشف نقاط البيع في سنغافورة وما حولها. تحقق من ساعات العمل والتوفر قبل الزيارة.', 'https://www.google.com/maps/search/Bellroy+stockists+Singapore', 50),
      ('Tokyo', 'طوكيو', 'Discover our stockists in and around Tokyo. Check current hours and availability before visiting.', 'اكتشف نقاط البيع في طوكيو وما حولها. تحقق من ساعات العمل والتوفر قبل الزيارة.', 'https://www.google.com/maps/search/Bellroy+stockists+Tokyo', 60);
  END IF;
END $$;
