import { timingSafeEqual } from 'node:crypto';
import { requestBatch } from '../lib/hubRuntimeTransport.mjs';
import { dangerouslyDeleteByTag, waitUntil, getCache } from '@vercel/functions';
import { schedule } from '../lib/hubJobQueue.mjs';

const tagsAllowed = new Set(['hub-feed-v1', 'hub-wiki-v1', 'hub-version-v1', 'hub-media-v1']);
const equal = (a, b) => {
  const left = Buffer.from(a || ''); const right = Buffer.from(b || '');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
};

async function runJobs(cron) {
  const { status, result } = await requestBatch(process.env.HUB_RUNTIME_ORIGIN, process.env.HUB_INTERNAL_SECRET, cron);
  console.log(JSON.stringify({ event: 'hub_batch_finished', ...result }));
  if (status !== 200 || !result.ok) throw new Error(`Batch runner failed: HTTP ${status}`);
  return result;
}

async function warmPublications(tags, expected = {}) {
  const targets = [];
  if (tags.includes('hub-feed-v1')) {
    for (const lang of ['zh-Hant', 'zh-Hans', 'en', 'ko']) {
      targets.push({ path: `/api/intel/feed?lang=${lang}`, kind: 'feed' });
    }
  }
  if (tags.includes('hub-wiki-v1')) targets.push({ path: '/api/wiki/beginner', kind: 'wiki' });
  if (tags.includes('hub-version-v1')) targets.push({ path: '/api/public/version', kind: 'version' });
  // Cache invalidation propagates between edge regions. Do not acknowledge an
  // outbox entry until canonical URLs have reached the committed revision.
  for (const target of targets) {
    let ready = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await fetch(`${process.env.HUB_RUNTIME_ORIGIN}${target.path}`, { signal: AbortSignal.timeout(12_000) });
      const body = await response.json();
      ready = response.ok && body.ok && (target.kind === 'version'
        ? body.feed >= (expected.feed || 0) && body.wiki >= (expected.wiki || 0)
        : Number(response.headers.get('x-hub-publication-revision')) >= (expected[target.kind] || 0));
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    if (!ready) throw new Error(`Cache publication did not reach committed revision: ${target.kind}`);
  }
}

export default {
  async fetch(request) {
    const authorization = request.headers.get('authorization');
    const cron = request.method === 'GET' && equal(authorization, `Bearer ${process.env.CRON_SECRET || ''}`) && Boolean(process.env.CRON_SECRET);
    const internal = request.method === 'POST' && equal(authorization, `Bearer ${process.env.HUB_INTERNAL_SECRET || ''}`) && Boolean(process.env.HUB_INTERNAL_SECRET);
    const headers = { 'Cache-Control': 'no-store' };
    if (!cron && !internal) return Response.json({ ok: false }, { status: 401, headers });
    if (cron) {
      try {
        if (process.env.HUB_JOB_CONTROL === 'vercel') return Response.json(await schedule(), { status: 202, headers });
        const { status, result } = await requestBatch(process.env.HUB_RUNTIME_ORIGIN, process.env.HUB_INTERNAL_SECRET, true, true, 25_000);
        if (status !== 200 || !result.ok) throw new Error('Unable to persist scheduled work');
        const dispatched = result.cache_pending > 0 || (result.running === 0 && result.queued > 0);
        if (dispatched) waitUntil(runJobs(false).catch(error => console.error('hub_scheduled_batch_failed', error.message)));
        return Response.json({ ...result, dispatched }, { status: dispatched ? 202 : 200, headers });
      }
      catch (error) { console.error(error.message, error.cause?.code || ''); return Response.json({ ok: false, error: 'Scheduled batch failed' }, { status: 502, headers }); }
    }
    let payload;
    try { payload = await request.json(); }
    catch { return Response.json({ ok: false }, { status: 400, headers }); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return Response.json({ ok: false }, { status: 400, headers });
    const tags = payload.tags || [];
    if (!Array.isArray(tags) || tags.some(tag => !tagsAllowed.has(tag))) return Response.json({ ok: false }, { status: 400, headers });
    // Foreground expiry: a post-save reader must not receive the previous Wiki.
    if (tags.length) {
      if (tags.includes('hub-version-v1')) await getCache({ namespace: 'hub-public-version' }).expireTag('hub-version-v1');
      await dangerouslyDeleteByTag(tags, { revalidationDeadlineSeconds: 0 });
      await warmPublications(tags, payload.expected || {});
    }
    if (payload.run_jobs === true && process.env.HUB_JOB_CONTROL !== 'vercel') waitUntil(runJobs(false).catch(error => console.error('hub_dispatch_failed', error.message)));
    return Response.json({ ok: true, invalidated: tags, dispatched: payload.run_jobs === true }, { headers });
  },
};
