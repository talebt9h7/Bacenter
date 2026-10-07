# Activity Log

This version adds a protected Activity Log under Configuration.

- View: `/admin/activity`
- Uses existing `activity_log` table.
- Filters: search, entity, date range.
- Access requires Configuration -> View.
- Team create/update/delete actions are recorded.
- Logging failures are isolated and do not block the underlying operation.

No destructive database migration is required because `activity_log` already exists in the project schema.
