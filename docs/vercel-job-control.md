# Vercel job controls and bounded Neon access

The isolated pilot uses `HUB_JOB_CONTROL=vercel`. Queues dispatches independent consumers: one content writer on
`hub-mutations-v1` (`maxConcurrency: 1`) and two question slots on
`hub-agent-v1` (`maxConcurrency: 2`). Claims enforce capacity per lane, so a
question and a sync can run together. Separate Python functions
(`/api/run_agent` and `/api/run_jobs`) execute them. A dedicated private Blob stores only
job input, ownership, progress and results. It is not a second content database.
The existing Python fetcher, classifier and translator are reused.

## Execution

1. Cron enqueues a deterministic half-hour slot in Vercel, without touching Neon.
2. Queue delivery claims ownership through a conditional Blob write. Progress
   and new submissions are also serialized using strong ETags. Reads bypass
   the Blob CDN and request identity encoding: compressed HTTP responses can
   have weak ETags, which are unsuitable for conditional writes.
3. Python loads verified existing text, settings and translation snapshots from
   Neon into one disposable workspace. This is a loading phase, not one SQL query.
   AI assistant jobs also capture the separately published Wiki, including its
   revision and content hash, into `.published-wiki.json` during this phase.
   The AI subprocess checks that hash and reads this explicit processing input;
   it never opens a database connection or substitutes an older Wiki.
4. Source/AI processing has empty Neon DSN variables and
   `HUB_FORBID_DATABASE=1`. The shared PostgreSQL connector rejects any attempted
   access. Progress is throttled to at most one private Blob update per 15 seconds.
   Vercel Queue SDK extends its visibility lease; no SQL heartbeat runs.
5. Questions check Vercel ownership and return their answer without running
   translation, feed publication, source comparison or public cache invalidation.
   Derived official-document/embedding/index caches persist in `hub_query_cache`,
   separate from content snapshots. Conditional writes preserve a newer cache
   produced by a concurrent question. They never take the content publication lock.
   No old-site or substitute-answer path is introduced.
6. For content mutations, after validation, check Vercel ownership, then commit content and the unique
   job result to `hub_job_commits` in the same PostgreSQL transaction. Source
   hashes must still agree, so concurrent editorial changes cannot be overwritten.
7. For content mutations, flush durable cache tags and warm the committed public versions. This is the
   final database phase. The function then exits.

Explicit backup/restore operations intentionally access their database restore
points; they are not source/AI processing. Ordinary reads, editing, login and
cache misses can independently wake Neon.

## Failure and duplicate delivery

- Queue send uses job ID as its idempotency key. Duplicate submits of the same
  active user action return its existing job; repeated schedule ticks reuse
  the active sync. An already claimed job is not executed again on redelivery.
- Blob state uses compare-and-swap, not a runtime-cache lock. Ownership expires
  32 minutes after claim, beyond the 30-minute function ceiling. The next
  submission marks an expired run failed; AI is not automatically replayed.
- A transport failure is uncertain: Python may still be working or have committed.
  Keep ownership until the bounded invocation must have ended, and visibly mark
  the uncertainty. An operator must inspect the publication before retrying.
- Final job commits are idempotent even if their response is lost. A repeated
  transaction returns the original result without incrementing the publication.
- Vercel control failures return errors; there is no switch back to SQL control.

## Progress and access

The initial authenticated management response grants a one-hour, read-only HMAC
capability for the job list. Individual job responses grant a capability scoped
to that job. The status route validates signatures and expiry without SQL.
An expired capability requires reloading the authenticated management view.
Neither capability permits editing or internal queue operations.

Management loads its detailed snapshot once, then polls Vercel status every
five seconds while visible. Completion or the existing refresh button reloads
details. The old five-second full SQL-backed admin-status poll is removed.
React and legacy job clients use the same scoped status contract.

## Measurement

Job metrics record load/publication connection timestamps and processing start/
end. A control-plane-only Neon observer confirms actual active/idle transitions
without querying the database. These establish awake time, not invoice dollars
or measured CU-hour consumption. Compute dollars require average actual CU.
Blob write logs report byte size and retry count, without inputs or credentials.
Private Blob/Queue/functions usage is separately billed and may use team credits.

## Isolation verification (2026-10-19)

Lane claims are checked in both start orders, with writer capacity, agent
capacity, wrong-consumer rejection and duplicate delivery. A controlled worker
check holds background publication open while a question finishes. A separate
Neon test schema holds the real writer advisory lock and a feed row lock while
the query cache persists, then verifies stale cache writes are rejected and the
feed revision is unchanged. Live overlap evidence is recorded separately; paid
answer quality remains pending the existing OpenAI credit issue.
