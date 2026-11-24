# OpenAI text migration — local review, 2026-11-24

Working checkout: `/Users/gavin/.codex/worktrees/website-openai-luna-1124/website`.
Branch `codex/website-openai-luna-1124`, base `eea9260`. Not pushed; no PR or
production configuration changes. Existing Vercel/Neon/Queues publication and
authentication flows remain the owners of deployment and content writes.

## Scope and configuration

All active MiniMax text calls now use `scripts/text_ai.py`, OpenAI Responses,
model `gpt-6-luna`, reasoning `low`, `store=false`. The adapter extracts only
completed final output, rejects incomplete/refused/empty output and exposes
safe HTTP status codes. It never switches provider or model after failure.
Translation JSON arrays retain their shape; feature validators retain their
own schemas and publication rules. No new SDK dependency is needed.

Key priority is `INTEL_OPENAI_TEXT_API_KEY`, `OPENAI_TEXT_API_KEY`, then
`OPENAI_API_KEY`. `.env.example` documents output and timeout settings.
Agent-specific settings use `INTEL_AGENT_TEXT_MODEL`,
`INTEL_AGENT_MAX_OUTPUT_TOKENS`, `INTEL_AGENT_CONNECT_TIMEOUT_SECONDS` and
`INTEL_AGENT_READ_TIMEOUT_SECONDS`. Old MiniMax settings are no longer read.
Embedding generation keeps its separate existing OpenAI embedding settings.
Historical cards/answers keep their true historical model attribution; no
bulk reclassification, embedding rebuild or cache invalidation is forced.

| Text feature | Owning code | Live verification |
| --- | --- | --- |
| Story analysis / classification | x_intel/sources.py | Brand-positioning post → insight; actual GIWATER integration → product_progress; both ai_status=ok |
| Event geography | x_intel/sources.py | Bangkok AMA → th with source-based reason |
| Product lifecycle | x_intel/sources.py | GIWATER completed integration → completed |
| Digest / official overview | x_intel/sources.py, feedback_feed.py | JSON accepted; source facts retained; non-repeating short overview |
| Global dedupe | x_intel/feedback_feed.py | Two distinct protected official posts retained |
| Feedback rule distillation | x_intel/feedback_feed.py | Corrected branding example produces reusable ready rule |
| Feed translation | website_i18n_runtime.py | Actual English/Korean array calls preserve count, URL, handle and numbers |
| Wiki translation | website_i18n_runtime.py | 536-character source field retains final 987654 marker and URL |
| RAG answer generation | x_intel/knowledge_agent.py | Actual NeoSoul post produces Traditional Chinese answer with [1] and provider=openai |

The Vercel worker key preflight, admin progress events, translation worker,
error labels and legacy frontend provider display also follow the new adapter.
The i18n diagnostic now prints key presence only, never credential substrings.
Historical TCG API notes and historical RAG reports remain historical records.

## 1Password and verification boundary

The original website local `.env` key returned 401 and was left unchanged.
The existing key in 1Password's API Keys vault successfully accessed the model
and completed actual Responses calls. No vault items were added/modified.
The ignored, permission-restricted `.secrets/openai-local.env` contains only a
1Password reference plus public model settings; `op run` injects the secret
at process launch. No credential is stored in Git, review reports or chat.
CLI usage does not require restarting Codex.

`tests/test_text_ai.py` covers transport shape, configuration, failure handling,
key selection, source-backed categories and serialization. Live results are
kept in `.run_logs/openai-luna-review/live-results.json`; only public source text,
outputs, model identifiers, timing and token counts are recorded. These are
small feature-level checks, not full production reanalysis or authenticated
end-to-end Wiki save / queued RAG acceptance. No production data was written.

## Category root cause

CLTB was described as Web2 promotion, and explicit partnership inference was
restricted to Index. Its role now describes the Protocol account accurately.
`official_updates.py` adds independently evidenced News facets without
rewriting canonical post types. Both StoryCard serialization and canonical
public feed reads expose the corrected metadata. JavaScript landing cache
and Python rules match categories/evidence on all 69 captured CLTB rows:
Community 27, Events 33, Product 9, Partnership 4, Builders 2. Multiple facets
refer to the same post. This does not add XYZ or any other account to landing.

## Local CLTB reclassification review

The actual shared Luna classifier processed all 69 captured CLTB posts. Ten
post types changed after source review. An observed recap/insight confusion and
an event reminder/announcement confusion were addressed in the classifier
prompt; the affected examples were rerun through the same validators. One
copy initially failed the speculative-copy guard, remained in the review queue,
and passed a subsequent source-constrained run. No validator was disabled.
All 69 final records are ai_status=ok; this is technical validation and agent
review, not Gavin's acceptance.

The complete results, source hashes, exact reasons and earlier exception
results are in `.run_logs/openai-luna-review/cltb-reclassification.json`.
Only the reviewed post type is applied to an explicit local landing cache
snapshot. Existing English editorial copy retains its original attribution.
The public Hub/database is unchanged. Reclassification of existing production
posts must use the authenticated existing publication flow after release
approval; changing provider configuration alone does not rewrite history.
The local candidate contains Events 33, Product 7, Community 29, plus the
independent Partnership 4 and Builders 2 facets. Landing's normal hourly
acquisition must use the corrected upstream publication before reopening News;
otherwise a later refresh would restore the current upstream post types.

## Explicit failure policy approved on 2026-11-24

Gavin approved fixing both sides and keeping only the landing header entry
hidden. Digest, official overview and global text dedupe now propagate model
transport failures and reject malformed/incomplete output. They do not replace
failed generated summaries with templates or label a dedupe failure as a
successful zero-duplicate result. Empty source input retains an explicit empty
state without calling the model. A valid brief overview is accepted without
padding it to a template's length.

Dedupe rejects unknown/protected IDs and excessive removal rather than silently
ignoring them. The existing finite worker publishes only after its processing
subprocess succeeds; a new failure-boundary test confirms failed processing
cannot call the snapshot commit. Therefore the prior production publication
remains authoritative. Its SQL transaction was not exercised against a live
database in this local change.

16 website unit tests pass, covering transport, schema failures, invalid key
configuration, empty data and the commit boundary. Actual digest, overview and
dedupe calls with the existing 1Password key also pass the stricter validation;
results: `.run_logs/openai-luna-review/failure-policy-live-results.json`.
The non-strict legacy translation path still has its original source-text
behavior; strict feed publication and Wiki saves already reject incomplete
translations. No provider/model substitution was added.

Before release: review these local changes, explicitly approve branch push,
inspect PR checks, approve merge, configure a valid server-side OpenAI key in
the intended Vercel project, and use its existing GitHub deployment pipeline.
Landing hides only its News header entry; direct listing/article routes are
enabled in the pending code. Seed/verify the cache and cron before deploying
that code, and publish corrected upstream classifications before syncing them.

Temporary live-check scripts and the isolated auth SQLite database were removed.
The review JSON reports and the gitignored 1Password reference remain.
