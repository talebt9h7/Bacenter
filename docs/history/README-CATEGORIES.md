# Categories v30

Adds database-backed product categories.

## Migration
Run `drizzle/0006_categories.sql` in the Supabase SQL editor before using the new Categories admin page.

## Admin
`Catalog -> Categories`

Categories can be created, edited, hidden and deleted. A category with products cannot be deleted until those products are reassigned.

Product create/edit now loads categories from the database. Existing legacy category slugs remain supported as a fallback until migration is applied.
