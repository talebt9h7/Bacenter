# v38 — Products API + Categories schema alignment

- Fixed the Supabase `categories` table to match the Drizzle schema used by the admin app.
- Seeded the 8 catalog categories used by the existing product data.
- Added a safe GET error boundary to `/api/admin/products` so server errors are logged and development mode exposes the underlying message.
- Added Next.js `data-scroll-behavior="smooth"` to remove the route-transition warning.

The database migration has already been applied to the connected Supabase project.
