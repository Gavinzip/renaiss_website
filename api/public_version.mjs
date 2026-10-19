import { randomUUID, createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';

/** The runtime cache also protects Neon when a client forces CDN revalidation. */
export default {
  async fetch() {
    const headers = {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    };
    try {
      const cache = getCache({ namespace: 'hub-public-version' });
      let value = await cache.get('v1');
      const hit = value !== null;
      if (!hit) {
        const response = await fetch(`${process.env.HUB_RUNTIME_ORIGIN}/api/internal/public-version`, {
          headers: { Authorization: `Bearer ${process.env.HUB_INTERNAL_SECRET}` },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`Version origin HTTP ${response.status}`);
        value = await response.json();
        if (!value.ok || !Number.isSafeInteger(value.feed) || !Number.isSafeInteger(value.wiki)) {
          throw new Error('Invalid version publication');
        }
        await cache.set('v1', value, { ttl: 1800, tags: ['hub-version-v1'] });
      }
      console.log(JSON.stringify({ event: 'hub_version_cache', hit }));
      return Response.json(value, { headers: {
        ...headers,
        'Vercel-CDN-Cache-Control': 'public, max-age=1800',
        'Vercel-Cache-Tag': 'hub-version-v1',
        'X-Hub-Origin-Read': randomUUID(),
        'X-Hub-Runtime-Cache': hit ? 'HIT' : 'MISS',
        ETag: `W/"${createHash('sha256').update(JSON.stringify(value)).digest('hex')}"`,
      } });
    } catch (error) {
      console.error('hub_version_cache_error', error.message);
      return Response.json({ ok: false, error: 'Publication version unavailable' }, { status: 503, headers });
    }
  },
};
