# Renaiss Community Hub

This is the React + TypeScript source for the new Community Hub. It is separate
from the legacy static pages, which remain under `website/`.

## Local development

```bash
pnpm install
pnpm dev
```

The development server runs on `http://127.0.0.1:8792` and proxies `/api` calls
to the live Renaiss service, so the feed is tested against the current remote
data.

## Build and release package

```bash
pnpm typecheck
pnpm build
```

The production bundle is written to `website/community-hub/`. The existing
`scripts/sync_frontend_chain.sh` command copies this bundle to
`frontend_chain/community-hub/` only after a build exists. This preserves the
legacy Community Hub and original site pages while adding the new React route.

## Data ownership

- Guide content and the evergreen SBT catalog are read from the existing static
  Renaiss sources.
- The live feed is read through `/api/intel/feed`.
- Missing source imagery is displayed with the established Renaiss default
  cover; the source data itself is not invented or changed.
