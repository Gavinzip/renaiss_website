# Vercel public cache and finite jobs

The public feed, Wiki and version endpoint use Vercel CDN cache for 1,800
seconds. Only anonymous representations are cached: the feed has already passed
publication visibility rules, and Wiki permissions are obtained separately from
`/api/auth/me`. Public clients omit credentials and use stable language URLs.
Browser responses use `no-store`; `Vercel-CDN-Cache-Control` controls the shared
edge cache. An edge HIT bypasses the Python function and Neon entirely. A MISS,
expiry, edit or authenticated operation can still wake Neon.

Generated covers use a seven-day CDN TTL with browser revalidation. Changed
covers and restores invalidate their media tag. Hashed frontend assets remain
compressed with a one-year immutable cache; HTML and private APIs are uncached.

## Publishing and freshness

A publication records cache tags in `hub_cache_outbox` in the same transaction as
the content/revision. After commit, the server asks the private Node runtime to
expire those tags and warm canonical URLs. It checks committed revision numbers
to account for edge propagation before acknowledging outbox IDs. Concurrent
publications retain their own IDs. A failure remains pending for the next cron;
Wiki editors receive an explicit pending message, and no AI save is repeated.

The version endpoint has a tagged Vercel Runtime Cache as well as CDN cache.
This prevents client-forced CDN revalidation from querying Neon every minute.
Publication invalidation expires both cache levels. Its uncached Python origin
requires the internal bearer secret, and cache failures return an error.

Visible browser tabs check the tiny cached version endpoint once per minute.
Only a changed version reloads public content. Background tabs stop these
checks. Drafts retain their original base hash, so this refresh cannot cause an
older editing draft to overwrite somebody else's newer publication.

## Finite jobs

`GET /api/runtime` is called by Vercel Cron at `*/30 * * * *`. It requires the
configured `CRON_SECRET`. With `HUB_JOB_CONTROL=vercel`, it persists due work in
a dedicated private Blob and dispatches through Vercel Queues, without SQL.
The consumer runs one bounded Python job at a time. Source/AI processing has no
Neon credentials and rejects SQL; progress and visibility leases use Vercel.
Only initial loading and final publication/cache warming access Neon.
POST bodies, login, job progress and editing are never CDN-cached.

The processing budget is 25 minutes. There is no idle database poll or daemon,
and interrupted AI work is not automatically replayed. Strong ETag controls,
job capabilities, final commit deduplication and recovery are documented in
[vercel-job-control.md](vercel-job-control.md).

Node and Python max durations are 1,800 seconds on Pro Fluid compute. The Node
batch transport uses HTTPS with an explicit 1,650-second deadline: Node fetch's
independent 300-second headers timeout must not cut a longer request short.
The private Python response sends JSON-compatible whitespace heartbeats during
active work to avoid transport idle limits; the final body remains one JSON object.
Schedule timestamps align to UTC half-hour boundaries, avoiding missed ticks
from scheduling relative to a function's start time.

The existing source fetcher/classifier/translator still runs. Source errors or
incomplete translations fail explicitly and do not publish substitute content.
Each cold processing workspace downloads verified text snapshots, not media;
this processing traffic is separate from CDN visitor traffic.

## Server configuration

- `DATABASE_URL` / `WEBSITE_DATABASE_URL`: pooled Neon TLS DSN.
- `HUB_INTERNAL_SECRET`: random server-only shared secret.
- `HUB_RUNTIME_ORIGIN`: stable HTTPS origin of the isolated Vercel project.
- `CRON_SECRET`: random server-only Vercel Cron bearer secret.
- `HUB_DB_POOL_ENABLED=0`: close request-scoped DB connections.
- `HUB_JOB_CONTROL=vercel`: Queue/private Blob controls, no SQL heartbeat.
- Connect the dedicated private Blob store to provide its server-only credentials.
- Existing classifier/translation/auth settings remain required.

Do not put these credentials in browser assets or commit real `.env` files.
The project has no daemon definitions. Neon scale-to-zero remains enabled;
endpoint suspend timeout `0` means the Launch plan's default five-minute idle
window, and `-1` would disable it. The 0.25–2 CU range is a capacity bound, not a
monthly dollar spending cap. Storage/history can accrue charges while compute
is asleep.
