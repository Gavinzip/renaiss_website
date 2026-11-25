"""One owner for complete X originals. No AI, preview substitution or HTML execution."""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
import json
import re
import time
from threading import Lock
from urllib.parse import urlparse

import requests

VERSION = 'fxembed-original-v1'
_request_lock = Lock()
_next_request_at = 0.0
_rate_limited = False
_persisted_sources = {}


def cached_source(account, sid):
    return _persisted_sources.get((account.lower().lstrip('@'), str(sid)))


def _cache_card(card):
    original = card.original_content
    _persisted_sources[(card.account.lower().lstrip('@'), str(card.id))] = (original, {
        'id': str(card.id), 'account': card.account, 'text': plain_text(original),
        'created_at_iso': original['publishedAt'], 'cover_image': card.cover_image,
        'article_id': card.article_id, 'article_title': original['title'] if original['acquisition'].get('article') else '',
        'article_preview': '', 'article_fetch_status': 'complete', 'original_content': original,
        'reply_to_id': card.reply_to_id, 'reply_to_account': '', 'metrics': card.metrics})


def _pace_request():
    global _next_request_at
    with _request_lock:
        if _rate_limited: return False
        delay = _next_request_at - time.monotonic()
        if delay > 0: time.sleep(delay)
        if _rate_limited: return False
        _next_request_at = time.monotonic() + 1.0
        return True


def media_url(value, host):
    parsed = urlparse(str(value or ''))
    if parsed.scheme != 'https' or parsed.hostname != host or parsed.username or parsed.password or parsed.port:
        raise ValueError('Original media identity is invalid')
    return value


def inline(text):
    parts = []
    for value in re.split(r'(https?://[^\s]+|@[a-zA-Z0-9_]{1,15}\b)', text):
        if not value: continue
        part = {'text': value}
        if value.startswith('@'): part['href'] = 'https://x.com/' + value[1:]
        elif value.startswith(('https://', 'http://')): part['href'] = value
        parts.append(part)
    return parts


def draft_children(block, entities):
    text = block['text']
    # X Draft ranges use UTF-16 offsets; never split an emoji's surrogate pair.
    offsets, size = {0: 0}, 0
    for index, char in enumerate(text):
        size += len(char.encode('utf-16-le')) // 2
        offsets[size] = index + 1
    # Native emoji already exists in text; X's TWEMOJI asset annotations can
    # have stale offsets and must never split or replace those source characters.
    entity_ranges = [r for r in block.get('entityRanges', []) if entities[str(r['key'])]['type'] != 'TWEMOJI']
    ranges = [*block.get('inlineStyleRanges', []), *entity_ranges]
    cuts = sorted({0, size, *(n for r in ranges for n in (r['offset'], r['offset'] + r['length']))})
    if any(n not in offsets for n in cuts): raise ValueError('Invalid original text ranges')
    parts = []
    for start, end in zip(cuts, cuts[1:]):
        part = {'text': text[offsets[start]:offsets[end]]}
        for row in ranges:
            if row['offset'] > start or row['offset'] + row['length'] < end: continue
            if str(row.get('style', '')).lower() in {'bold', 'italic'}: part[row['style'].lower()] = True
            if 'key' in row:
                entity = entities[str(row['key'])]
                if entity['type'] == 'TWEMOJI': continue  # Keep the original Unicode emoji text.
                href = entity.get('data', {}).get('url', '')
                if entity['type'] != 'LINK' or urlparse(href).scheme not in {'https', 'http'}:
                    raise ValueError('Invalid original link')
                part['href'] = href
        parts.append(part)
    return parts


def article_blocks(article):
    rows = article.get('content', {}).get('blocks')
    if not isinstance(rows, list) or not rows or len(rows) > 500: raise ValueError('X Article has no complete body')
    entities = {str(r['key']): r['value'] for r in article['content'].get('entityMap', [])}
    media = {r['media_id']: r['media_info'] for r in article.get('media_entities', [])}
    kinds = {'unstyled': 'paragraph', 'blockquote': 'quote', 'header-one': 'heading', 'header-two': 'heading',
             'header-three': 'heading', 'unordered-list-item': 'list-item', 'ordered-list-item': 'list-item', 'code-block': 'code'}
    blocks = []
    cover = article.get('cover_media', {}).get('media_info', {}).get('original_img_url')
    if cover: blocks.append({'kind': 'image', 'src': media_url(cover, 'pbs.twimg.com'), 'alt': article['title']})
    for row in rows:
        if row['type'] == 'atomic':
            if not row.get('entityRanges'):
                if not row.get('text', '').strip() and not row.get('data'): continue  # Empty Draft spacer.
                raise ValueError('Missing article media reference')
            for ref in row['entityRanges']:
                entity = entities[str(ref['key'])]
                if entity['type'] == 'TWEET':
                    sid = str(entity['data']['tweetId'])
                    if not re.fullmatch(r'\d{15,22}', sid): raise ValueError('Invalid embedded tweet')
                    href = 'https://x.com/i/status/' + sid
                    blocks.append({'kind': 'paragraph', 'children': [{'text': href, 'href': href}]})
                    continue
                if entity['type'] != 'MEDIA' or not entity.get('data', {}).get('mediaItems'):
                    raise ValueError('Unsupported article entity')
                for item in entity['data']['mediaItems']:
                    info = media[item['mediaId']]
                    caption = entity['data'].get('caption', '')
                    if info.get('__typename') == 'ApiVideo':
                        variants = [v for v in info.get('variants', []) if v.get('content_type') == 'video/mp4']
                        if not variants: raise ValueError('Original article video is unavailable')
                        selected = max(variants, key=lambda v: v.get('bit_rate', 0))
                        blocks.append({'kind': 'video', 'src': media_url(selected['url'], 'video.twimg.com'),
                                       'poster': media_url(info['preview_image']['original_img_url'], 'pbs.twimg.com'), 'caption': caption})
                    else:
                        blocks.append({'kind': 'image', 'src': media_url(info['original_img_url'], 'pbs.twimg.com'), 'alt': caption, 'caption': caption})
        else:
            if row['type'] not in kinds: raise ValueError('Unsupported original article block')
            if not row['text'].strip(): continue
            block = {'kind': kinds[row['type']], 'children': draft_children(row, entities)}
            if block['kind'] == 'heading': block['level'] = 2
            if row['type'] == 'ordered-list-item': block['ordered'] = True
            blocks.append(block)
    return blocks


def normalize_original(post, account, sid):
    account = account.lstrip('@')
    canonical = f'https://x.com/{account}/status/{sid}'
    if (post.get('type') != 'status' or str(post.get('id')) != sid
        or post.get('author', {}).get('screen_name', '').lower() != account.lower()
        or str(post.get('url', '')).lower() != canonical.lower()
        or not isinstance(post.get('is_note_tweet'), bool)):
        raise ValueError('Original post identity mismatch or unavailable post')
    if account.lower() == 'renaisscltb' and str(post['author'].get('id')) != '1505163583852019712':
        raise ValueError('CLTB author identity mismatch')
    text = post.get('text')
    if not isinstance(text, str) or not text.strip() or len(text) > 100000: raise ValueError('Original text missing or oversized')
    published = datetime.fromtimestamp(post['created_timestamp'], timezone.utc)
    if published.timestamp() > time.time() + 300: raise ValueError('Original date is invalid')
    article = post.get('article')
    if not article and re.search(r'https?://(?:x|twitter)\.com/i/article/', text): raise ValueError('Missing X Article body')
    title = article['title'] if article else next(row for row in text.splitlines() if row.strip())[:300]
    blocks = article_blocks(article) if article else [{'kind': 'paragraph', 'children': inline(p)} for p in re.split(r'\n\s*\n', text) if p.strip()]
    for asset in post.get('media', {}).get('all', []):
        if asset['type'] == 'photo': blocks.append({'kind': 'image', 'src': media_url(asset['url'], 'pbs.twimg.com'), 'alt': title})
        elif asset['type'] in {'video', 'gif'}:
            block = {'kind': 'video', 'src': media_url(asset['url'], 'video.twimg.com')}
            if asset.get('thumbnail_url'): block['poster'] = media_url(asset['thumbnail_url'], 'pbs.twimg.com')
            blocks.append(block)
        else: raise ValueError('Unsupported original media')
    if not blocks: raise ValueError('Original body missing')
    return {'schemaVersion': 1, 'id': sid, 'sourceUrl': canonical, 'sourceKind': 'x', 'coverage': 'full',
            'title': title, 'author': post['author'].get('name') or account, 'publishedAt': published.isoformat(),
            'retrievedAt': datetime.now(timezone.utc).isoformat(),
            'acquisition': {'provider': 'FxEmbed', 'version': VERSION, 'note': post['is_note_tweet'], 'article': bool(article)}, 'blocks': blocks}


@lru_cache(maxsize=2048)
def _request_status(sid):
    # Each worker is a fresh process. Discovery refresh and historical repair
    # share this intake; even failures are not retried implicitly in one job.
    global _rate_limited
    if not _pace_request(): return None, 'HTTP_429_cooldown'
    try:
        with requests.get('https://api.fxtwitter.com/2/status/' + sid, timeout=(3, 8), allow_redirects=False, stream=True) as response:
            response.raise_for_status()
            if 'application/json' not in response.headers.get('content-type', ''): raise ValueError('Invalid source response')
            raw = bytearray()
            for chunk in response.iter_content(65536):
                raw.extend(chunk)
                if len(raw) > 2000000: raise ValueError('Oversized original response')
            payload = json.loads(raw)
            if payload.get('code') != 200: raise ValueError('Original unavailable')
            return payload['status'], ''
    except requests.HTTPError as exc:
        if exc.response.status_code == 429: _rate_limited = True
        return None, 'HTTP_' + str(exc.response.status_code)
    except Exception as exc:
        return None, type(exc).__name__


def fetch_original(account, sid):
    if not re.fullmatch(r'[\w]{1,15}', account.lstrip('@')) or not re.fullmatch(r'\d{15,22}', sid): raise ValueError('Invalid source identity')
    post, error = _request_status(sid)
    if error: raise ValueError('Original acquisition failed: ' + error)
    return normalize_original(post, account, sid), post


def plain_text(original):
    return '\n\n'.join(''.join(p['text'] for p in b['children']) for b in original['blocks'] if 'children' in b)


def attach_original(card, original):
    card.original_content = original
    card.original_fetch_error = ''
    card.raw_text = plain_text(original)
    card.provider = 'fxembed'
    card.article_fetch_status = 'complete'
    card.article_blocks = [({'type': 'image', 'url': b['src'], 'alt': b.get('alt','')} if b['kind']=='image' else
                            {'type': 'heading' if b['kind']=='heading' else 'paragraph', 'text': ''.join(p['text'] for p in b.get('children',[]))})
                           for b in original['blocks'] if b['kind'] != 'video']
    card.media_images = [b['src'] for b in original['blocks'] if b['kind'] == 'image']
    if card.media_images: card.cover_image = card.media_images[0]


def refresh_existing_originals(cards, progress=None, budget_seconds=75, max_requests=48):
    """Incremental repair, prioritizing CLTB. Saved originals are the job cache.

    Missing originals precede hourly revalidation of recent full posts. Historical
    complete posts are reused; no source read or failed-read claim is invented.
    A 429 opens a process-wide circuit until the next scheduled worker, rather
    than flooding the provider or blocking the 900-second sync on retries.
    """
    targets = [c for c in cards if re.fullmatch(r'\d{15,22}', str(c.id)) and c.url.lower() == f'https://x.com/{c.account}/status/{c.id}'.lower()]
    missing, recent, errors = [], [], {}
    now = datetime.now(timezone.utc)
    for card in targets:
        doc = card.original_content
        valid = (isinstance(doc, dict) and doc.get('coverage') == 'full' and
                 doc.get('id') == str(card.id) and doc.get('sourceUrl', '').lower() == card.url.lower() and
                 doc.get('acquisition', {}).get('version') == VERSION and bool(doc.get('blocks')))
        if not valid or card.original_fetch_error:
            missing.append(card)
            continue
        # This is a confirmed stored source, not a successful new fetch. Any
        # failed revalidation below remains explicit and is not cleared here.
        _cache_card(card)
        try:
            age = (now - datetime.fromisoformat(doc['retrievedAt'].replace('Z', '+00:00'))).total_seconds()
            published_age = (now - datetime.fromisoformat(doc['publishedAt'].replace('Z', '+00:00'))).total_seconds()
            if age >= 3600 and published_age <= 30 * 86400: recent.append(card)
        except (KeyError, ValueError, TypeError): recent.append(card)
    priority = lambda c: (c.account.lower().lstrip('@') != 'renaisscltb', -int(c.id))
    queue = sorted(missing, key=priority) + sorted(recent, key=priority)
    deadline, done, attempted = time.monotonic() + budget_seconds, 0, set()
    for card in queue:
        if len(attempted) >= max_requests or time.monotonic() >= deadline or _rate_limited: break
        attempted.add(str(card.id))
        try:
            attach_original(card, fetch_original(card.account, str(card.id))[0])
            _cache_card(card)
            done += 1
        except Exception as exc:
            _persisted_sources.pop((card.account.lower().lstrip('@'), str(card.id)), None)
            card.original_fetch_error = str(exc)[:200]
        if progress: progress('original_source', done=done, total=len(targets), latest_source=card.account)
    deferred = []
    for card in targets:
        if card.original_fetch_error: errors[str(card.id)] = card.original_fetch_error
        if card in missing and str(card.id) not in attempted:
            deferred.append(str(card.id))
            errors.setdefault(str(card.id), 'original_backfill_pending')
    return {'total': len(targets), 'refreshed': done, 'attempted': len(attempted),
            'reused': len(targets)-len(missing), 'deferred': deferred,
            'rate_limited': _rate_limited, 'incomplete_or_unavailable': errors}
