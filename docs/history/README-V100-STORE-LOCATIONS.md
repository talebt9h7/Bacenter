# V100 — Store locations admin control

Added a real `store_locations` table and admin management screen for the public `/info/stores` page.

## Migration

Run `drizzle/0023_store_locations.sql` against the project's PostgreSQL database before using the new admin page. The migration creates the table, index, and seeds the six existing demo locations only when the table is empty.

## Admin

New page: `/admin/stores`

Requires `storefront` view/manage permissions.

The admin can add, edit, hide/show, delete, and reorder points of sale, including Arabic/English name, address, description, map URL, phone, opening hours, image URL, and visibility.

## Storefront

`/info/stores` now reads active locations from the database instead of the hard-coded city array. The existing six locations are preserved by the migration seed.
