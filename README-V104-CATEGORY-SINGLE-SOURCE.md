# V104 — Unified Categories

- The homepage category tabs now read from the database `categories` table via `getCategories()`.
- `/admin/categories` is the single source of truth for category English name, Arabic name, visibility and sort order.
- Removed the homepage hardcoded Arabic category-name map for the category tabs.
- Removed the duplicate editable category list from `/admin/homepage`; it now points to `/admin/categories`.
- Category create/update/delete revalidates the homepage and the affected category page.
- Added Arabic fallback names for legacy categories if the database is temporarily unavailable.

Note: the project is Next.js, matching the V103 architecture. `npm run build` was not run because dependencies are not installed in the provided workspace; the existing V103 tree also contains unrelated pre-existing TypeScript errors.
