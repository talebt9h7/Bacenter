# Team & Permissions — Stage 1

This stage adds staff accounts while keeping the existing Owner password login.

## Database
Run `supabase-team-permissions.sql` once in the Supabase SQL Editor.

## Login
- Owner: password only, uses `ADMIN_PASSWORD` (or the existing settings password hash).
- Team member: username + password.
- Team sessions are signed and tied to the `admin_users.id`.
- Disabled users cannot sign in.

## Roles
Manager, Sales, Inventory, Content, Accountant are templates only. Each user's section permissions can be customized.

## Sections
Overview, Sales, Catalog, Storefront, Finance, Configuration, Team & Permissions.

Each section has:
- View
- Manage

Manage automatically includes View.

## Security
- Team API endpoints require the relevant section permission server-side.
- Mutating endpoints require `manage`.
- The Team page itself requires `team.view`; creating/editing/deleting users requires `team.manage`.
- Owner bypasses all section checks.
