# Wiki content on PostgreSQL / Neon

Creator Mode keeps the existing React and legacy page editors. The backend
reads and writes PostgreSQL directly; no Directus process, token, Redis, local
JSON fallback, or snapshot worker is used for Wiki operations.

## Configuration

- `WEBSITE_DATABASE_URL`: server-only PostgreSQL connection string. Use Neon's
  pooled connection with TLS in Vercel. `DATABASE_URL` is also recognized by the
  existing shared database module.
- `WIKI_AUTO_TRANSLATE_ON_SAVE=1`: translate changed source-language fields using
  the existing MiniMax agent. The source can be Traditional Chinese, Simplified
  Chinese, English, or Korean. The default is enabled.
- Existing `INTEL_*`, `WIKI_CREATOR_*`, SSO, origin, and session settings remain
  responsible for access. Database credentials never reach the browser.

## Publication and editing

`GET /api/wiki/beginner` reads `hub_wiki_documents`. The returned document keeps
the existing shape, content hash and derived chapter routes. `meta.editable`
enables the legacy editor without depending on the old CMS provider name.

`POST /api/wiki/beginner` uses the original authenticated editor route. It requires
the loaded `base_hash`, merges only the selected language onto current content,
and translates changed fields before opening the write transaction. Failed
translation publishes nothing. Wiki fields are not truncated to the feed's
320-character limit; Traditional Chinese is translated when editing in English
or Korean too.

The update compares **both revision and hash in SQL**. Concurrent saves, including
different Vercel processes, cannot overwrite one another. A stale save returns
HTTP 409 with `code=wiki_conflict`. The publication and complete revision record
are committed together. The authenticated history endpoint reads revision
metadata without transferring historical documents.

Wiki saves run directly in the HTTP function, independently of the feed worker
and its snapshot hydration. The Vercel function has a 300-second maximum; a large
translation still needs live timing validation before production cutover.

## Migration

1. Export the current `GET /api/wiki/beginner` response and retain an additional
   raw export of all ten `wiki_*` collections for recovery, including unpublished
   rows if any. Do not put backups or credentials in the deployment bundle.
2. Set the target `WEBSITE_DATABASE_URL`, then run
   `python scripts/import_wiki_publication.py /absolute/path/to/published-wiki.json`.
   Import verifies the source hash and refuses to replace different existing
   target content. Retrying an identical import is safe.
3. Compare the imported hash, language counts, chapter order and media URLs to
   the live export. Validate real login, edit, translation, save, reload, conflict,
   history and process-restart persistence on the target.
4. Freeze source editing for the final export/import, then switch traffic only
   after approval. A live source change requires a new reviewed migration;
   the import command deliberately will not overwrite an edited target.
5. Retire the old CMS only after target acceptance and checking shared database
   and Redis consumers. This code change does not delete production services.

The previous CMS adapter and Flow callback are removed from the application.
The historical field model is available in Git history. An unavailable database
produces an error; it never silently serves an older file.
