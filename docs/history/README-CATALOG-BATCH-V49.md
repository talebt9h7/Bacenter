# Catalog batch bilingual v49

Updated together:
- Categories
- Collections
- Inventory
- Purchases & Suppliers

Added shared Arabic/English catalog translations and RTL/LTR-aware UI labels. Server-rendered catalog headings use the selected language cookie; client managers use the existing language provider.

No database schema changes were made.

TypeScript parser check was run on the modified files. Full build/typecheck was not possible in this extracted environment because node_modules are not installed.
