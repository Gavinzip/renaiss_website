# Complete X originals owned by Community Hub

`x_originals.py` is the source acquisition owner. `fetch_status_markdown` uses it for new/status refreshes; normal `sync_accounts` also backfills the existing tracked X cards in a six-worker bounded pass. Existing account discovery remains unchanged. There is no substitute preview provider after a full-original acquisition failure.

The FxEmbed v2 source returns the focal post, long note or X Article. The implementation validates post ID, canonical account URL, author and date; CLTB additionally has its fixed author ID. Full bodies preserve original characters, paragraph breaks, Draft links/emphasis with UTF-16 offsets, original images and MP4 videos. Source Unicode emoji is retained directly. Empty Draft spacers, embedded tweet references and article-video entities are handled explicitly; unknown content types fail validation instead of silently disappearing.

`original_content` stores the complete schema-1 reader document. `original_fetch_error` stores an explicit safe acquisition failure. Both survive StoryCard hydration, preserved-card serialization, existing-card refresh and public feed publication. The original is deliberately excluded from AI translation and its translation queue/hash. The legacy `article_blocks` projection supports existing Hub readers without changing their interaction flow; the separate original contract retains richer styles/media for consumers.

The existing per-post classification/summary fields remain separate. Their prompt budgets do not limit the original document. A failed source read preserves any previously acquired original and marks its acquisition error; this is an explicit saved-data safeguard, not proof that the new read succeeded. The batch result's warnings include incomplete/unavailable source counts. New inaccessible posts cannot be labelled complete. Landing rejects unavailable/incomplete CLTB source updates, retaining its previous cache with a visible sync failure.

Source requests have 3-second connect / 8-second read timeouts, a 2 MB response bound and no redirects. The historical pass has a 75-second dispatch budget and six workers; running calls finish within their individual bounds. Each fresh worker process shares a bounded success/failure source cache with normal collection, avoiding implicit retries during the same job. Scheduling of the existing sync and publication transaction boundaries is unchanged.

## Verification on 2026-11-25

Actual source intake: 520 existing public X posts across tracked Hub accounts. 515 originals passed after supporting real article emoji, embedded tweet and video structures. Four sources returned HTTP 404 and one returned HTTP 500; the cause behind those statuses is not asserted to be deletion/private content. All 74 CLTB posts passed. Landing cached 73 after its independent exclusion, with 71 images and 10 videos. The three previously browser-checked originals matched the newly acquired text after whitespace/link normalization and no longer have static exceptions.

Python suite: 22 tests covering the source identity/body boundary, >2,500-character preservation, persistence/hydration, original immutability across language translation, Draft emoji/embedded references, failure preservation, normal collection integration, and the existing OpenAI publication guards. The actual hydrated dataset and normal local Hub API are retained under ignored `.run_logs/hub-originals-1125/`; they are external-source verification evidence, not production writes or mocked API data.

These results establish tested acquisition and contract behavior, not a universal guarantee for unavailable/future X sources. The production pipeline and scheduled completion remain to be verified after an authorized PR release. Publish Hub first, run its normal sync/backfill, verify the public original contract, and only then release the landing consumer. No push or deployment is authorized by local completion.

Provider reference: https://docs.fxembed.com/api/twitter/operations/2statusid/
