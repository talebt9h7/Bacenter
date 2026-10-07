# Video Stories v29

Adds a dedicated Storefront → Video Stories manager.

- Uses the existing homepage settings store; no new database table is required.
- Manage YouTube ID, title, CTA label, CTA link, visibility and order.
- Storefront homepage now reads the managed video stories instead of a hardcoded list.
- Existing homepage data without `videoStories` is normalized to the defaults.
