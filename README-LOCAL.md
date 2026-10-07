# Bellroy — Local + Supabase

This project is configured to run locally while using the Supabase project `bellroy` as its PostgreSQL database.

## Environment

The included `.env.local` points to:
- Supabase project: `bellroy`
- Project ref: `gjjmshihdsxjvjubhbjs`
- Region: `ap-northeast-2`

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

Admin: http://localhost:3000/admin
Admin password: `bellroy-admin`

## Important

The `.env.local` included in this package uses `bellroy-admin` as the PostgreSQL password because that was requested for this setup. The Supabase database password itself must actually be set to the same value in the Supabase project for the connection to succeed. If the database password is still different, replace the password portion of `DATABASE_URL` in `.env.local` with the real password.

The app seeds products, shipping zones, banners, and content pages automatically on first access when the corresponding tables are empty.


## Compatibility fix v79
The settings table now self-heals if `updated_at` is missing from an older Supabase schema. Migration `0013_settings_schema_compat.sql` also adds it explicitly.
