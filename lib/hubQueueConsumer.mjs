import { queue, dispatch } from './hubJobQueue.mjs';
import { claim, update, enqueue } from './hubJobState.mjs';
import { requestJob } from './hubRuntimeTransport.mjs';

export function consumer(lane) {
  return queue.handleCallback(async ({ id }, metadata) => {
    const job = await claim(id, lane);
    if (!job) { console.log(JSON.stringify({ event: 'hub_duplicate_delivery_skipped', id, delivery: metadata.deliveryCount })); return; }
    console.log(JSON.stringify({ event: 'hub_vercel_job_started', lane, id, delivery: metadata.deliveryCount }));
    try {
      const { status, result } = await requestJob(process.env.HUB_RUNTIME_ORIGIN, process.env.HUB_INTERNAL_SECRET, job);
      if (status !== 200 || !result.ok) {
        await update(id, job.owner, { status: 'failed', error: result.error || 'Job failed', metrics: result.metrics || {} });
      } else {
        await update(id, job.owner, { status: 'done', result: result.result, metrics: result.metrics });
        if (lane === 'mutation' && result.result?.needs_translation) {
          const next = await enqueue('translate', { target_langs: ['zh-Hant','zh-Hans','en','ko'] }, job.created_by);
          await dispatch(next);
        }
      }
      console.log(JSON.stringify({ event: 'hub_vercel_job_finished', lane, id, ok: result.ok, metrics: result.metrics, cache: result.cache, revision: result.result?.revision }));
    } catch (error) {
      // A transport failure does not prove Python stopped or its transaction failed.
      // Preserve ownership until the bounded function is certainly dead. No AI replay.
      console.error('hub_vercel_job_completion_uncertain', id, error.message);
      await update(id, job.owner, { phase: '連線中斷，完成狀態待核對；系統不會自動重跑 AI。' });
      throw error;
    }
  }, { visibilityTimeoutSeconds: 1800, retry: () => ({ afterSeconds: 60 }) });
}
