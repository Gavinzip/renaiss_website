# Directus Wiki CMS

Renaiss uses Directus as the CMS source of truth and keeps the website as the
renderer/editor surface. Creators can edit the Wiki directly in the Renaiss
frontend Creator Mode. The frontend posts drafts to `/api/wiki/beginner`, and
the backend writes those changes into Directus with the server-side write token.
Directus Studio remains the formal CMS/admin backend.

## Environment

```env
DIRECTUS_URL=https://your-project.directus.app
DIRECTUS_TOKEN=server_side_read_token
DIRECTUS_WRITE_TOKEN=server_side_write_token
DIRECTUS_STUDIO_URL=https://your-project.directus.app
DIRECTUS_WIKI_SLUG=beginner
DIRECTUS_WIKI_STATUS=published
DIRECTUS_WIKI_CACHE_SECONDS=60
DIRECTUS_WIKI_READ_WITH_WRITE_TOKEN=1
DIRECTUS_WIKI_AUTO_TRANSLATE_ON_SAVE=1
DIRECTUS_WIKI_FLOW_SECRET=shared_secret_for_directus_flow
```

Keep `DIRECTUS_TOKEN` and `DIRECTUS_WRITE_TOKEN` only on the backend. The
browser calls the Renaiss API for writes; it never calls Directus directly with
write credentials.

`DIRECTUS_TOKEN` should be read-only. `DIRECTUS_WRITE_TOKEN` is required for
frontend Creator Mode saves and for the translation Flow described below.
When `DIRECTUS_WIKI_READ_WITH_WRITE_TOKEN=1`, the backend also uses that same
server-side write token for Directus reads, which keeps Creator Mode conflict
checks and save responses on the same current content view.

Creator Mode saves are source-language based. The browser sends the edited
language plus the `content_hash` it loaded; the backend rejects stale saves with
HTTP 409, reads the latest Directus data, merges only that source language,
scans all translatable Wiki fields, translates sibling languages through the
existing website translation agent, and writes one coherent Directus update.

## Collections

### `wiki_pages`

One row per Wiki page.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid/integer | Primary key |
| `slug` | string | Example: `beginner` |
| `status` | string | Use `published` for live content |
| `sort` | integer | Optional |
| `images` | json | Hero and section image URLs used by the rendered Wiki |
| `labels` | json | Localized UI copy visible in the Wiki shell and tool sections |
| `topics` | json | Localized Wiki category/topic cards and icons |
| `menu_labels` | json | Localized header dropdown and sidebar group labels |
| `commands` | json | Localized TCG Pro / Discord command cards |
| `command_showcase` | json | Command workflow example images and localized captions |
| `sbt_items` | json | Structured SBT checklist cards edited from frontend Creator Mode |

### `wiki_guide_translations`

Page-level text per language.

| Field | Type | Notes |
| --- | --- | --- |
| `page` | many-to-one -> `wiki_pages` | Required |
| `language` | string | `zh-Hant`, `zh-Hans`, `en`, `ko` |
| `title` | string | Hero title |
| `subtitle` | text | Hero subtitle |
| `eyebrow` | string | Hero chip |

### `wiki_stats`

Hero stat cards per language.

| Field | Type | Notes |
| --- | --- | --- |
| `page` | many-to-one -> `wiki_pages` | Required |
| `sort` | integer | Display order |
| `language` | string | Locale |
| `label` | string | Small label |
| `value` | string | Main value |

### `wiki_sections`

Structural rows. These decide placement, page category, image, and section type.

| Field | Type | Notes |
| --- | --- | --- |
| `page` | many-to-one -> `wiki_pages` | Required |
| `status` | string | `published` |
| `sort` | integer | Display order |
| `topic` | string | `start`, `packs`, `market`, `sbt`, `tcg` |
| `type` | string | `intro`, `steps`, `imageText`, `cards`, `sbtChecklist`, `ratings` |
| `image_index` | integer | Uses bundled image by index |
| `image_file` | file | Optional Directus asset |
| `image_url` | string | Optional external image URL |
| `layout` | string | `image-left`, `image-right`, `image-top` |

### `wiki_section_content`

Localized main copy for each section.

| Field | Type | Notes |
| --- | --- | --- |
| `section` | many-to-one -> `wiki_sections` | Required |
| `language` | string | Locale |
| `title` | string | Section heading |
| `text` | text | Main paragraph |
| `intro` | text | Used by ratings sections |
| `intro_title` | string | Used by SBT sections |

### `wiki_section_items`

Repeatable bullets/cards/steps without asking creators to edit raw JSON.

| Field | Type | Notes |
| --- | --- | --- |
| `section` | many-to-one -> `wiki_sections` | Required |
| `sort` | integer | Display order |
| `language` | string | Locale |
| `item_group` | string | `bullets`, `items`, `primer` |
| `title` | string | Card/step title |
| `body` | text | Bullet text or card body |

For `item_group=bullets`, `body` is used as the bullet text.

### `wiki_tools`

Community tools.

| Field | Type | Notes |
| --- | --- | --- |
| `status` | string | `published` |
| `sort` | integer | Display order |
| `link` | string | URL |
| `authors` | text | Comma-separated author names |

### `wiki_tool_translations`

| Field | Type | Notes |
| --- | --- | --- |
| `tool` | many-to-one -> `wiki_tools` | Required |
| `language` | string | Locale |
| `name` | string | Tool name |
| `link_label` | string | Button label |

### `wiki_faqs`

| Field | Type | Notes |
| --- | --- | --- |
| `page` | many-to-one -> `wiki_pages` | Required |
| `status` | string | `published` |
| `sort` | integer | Display order |

### `wiki_faq_translations`

| Field | Type | Notes |
| --- | --- | --- |
| `faq` | many-to-one -> `wiki_faqs` | Required |
| `language` | string | Locale |
| `question` | string | FAQ question |
| `answer` | text | FAQ answer |

## Roles

Create a Directus role such as `Renaiss Wiki Creator` for Directus Studio use:

- Allow create/read/update/delete for the Wiki collections above.
- Allow read/upload/update for `directus_files` if creators manage Wiki images.
- Do not grant access to unrelated Directus system settings.

The Renaiss backend should use separate read and write server tokens. Human
creators can use Renaiss Creator Mode for daily edits; Directus Studio accounts
are still useful for lower-level CMS maintenance.

## Translation Flow

For "edit one language, let the agent translate the rest", keep editing inside
Directus Studio and create a Directus Flow that calls the Renaiss backend after
a creator updates the source-language rows.

Recommended Flow:

1. Trigger: manual button or item-update trigger on the Wiki translation
   collections.
2. Operation: Webhook / HTTP request.
3. URL: `https://your-renaiss-domain/api/wiki/directus/translate`.
4. Method: `POST`.
5. Header: `X-Renaiss-Wiki-Secret: <DIRECTUS_WIKI_FLOW_SECRET>`.
6. Body:

```json
{
  "slug": "beginner",
  "source_lang": "zh-Hant",
  "target_langs": ["zh-Hans", "en", "ko"]
}
```

The endpoint reads the Directus Wiki rows, uses the existing Renaiss translation
runtime, and writes translated sibling rows back into Directus. It creates
missing translation rows and updates existing ones.

For English/Korean targets, configure the same MiniMax translation key used by
the Renaiss intel runtime. If the key is missing, the endpoint returns
`missing_minimax_api_key` and does not write untranslated fallback text.

## Frontend Behavior

- Website route stays `beginner.html`.
- Header and Renaiss visual design stay in local frontend code.
- Directus controls content, order, topic/category, image asset, and layout.
- If Directus is configured but broken, the API returns an error instead of
silently falling back to stale local JSON.
