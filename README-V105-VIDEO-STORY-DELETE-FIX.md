# V105 — Video Stories Delete Fix

- Video stories are now treated as database-owned content.
- Deleting a story no longer recreates it from legacy `settings.homepage.videoStories`.
- If the admin deletes the last story, the homepage remains empty instead of restoring default stories.
- DELETE now verifies that the requested story existed and returns 404 when it did not.
- Remaining story sort order is normalized after deletion.
- The admin UI also keeps the edit index consistent after deleting a story.
