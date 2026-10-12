# Bellroy Admin v35 — Bilingual foundation

This stage adds the language infrastructure only; it does not translate the existing admin copy yet.

- Languages: English (`en`) and Arabic (`ar`)
- Selection is persisted in a cookie and localStorage.
- `<html lang>` and `dir` switch between `en/ltr` and `ar/rtl`.
- Admin sidebar moves from left to right in Arabic.
- Admin main content margin follows the sidebar direction.
- Desktop and mobile sidebar behavior is preserved.
- Existing database schema and business logic are unchanged.

Next stage: translate the admin navigation using the central language system.
