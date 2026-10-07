# Admin bilingual batch v55

Updated five admin sections from the v54 baseline:
- Reports
- Settings
- SEO
- URL Redirects
- Backup & Restore

Added Arabic/English translation support and language-aware labels for the modified admin UI. No database schema changes were made.

Validation note: the project dependencies are not installed in this working directory, so a full Next.js build/typecheck cannot be claimed. Modified files were inspected for parser/syntax issues; the remaining tsc output is dependency/type-environment related and existing project typing noise.
