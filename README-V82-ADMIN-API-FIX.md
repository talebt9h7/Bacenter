# v82 Admin API fix

- `/api/admin/settings` GET now permits storefront managers because it returns the public settings payload.
- `/api/admin/settings` PUT permits `homepage`, `footer`, `navigation`, and `homeValues` for users with storefront manage permission; configuration-only settings remain protected.
- Banner image validation now accepts safe same-origin asset paths, not only `/images` and `/api/media`.
