import { QueueClient } from '@vercel/queue';
import { enqueue, readState } from './hubJobState.mjs';
import { lanes, jobLane } from './hubJobLanes.mjs';

export const queue = new QueueClient({ region: 'sin1' });
export async function dispatch(job) {
  if (job.status !== 'queued') return;
  await queue.send(lanes[jobLane(job)].topic, { id: job.id }, { idempotencyKey: job.id, retentionSeconds: 86_400 });
}
export async function schedule() {
  await enqueue('sync', { days: 30 }, 'scheduled', true);
  const { state } = await readState();
  const pending = state.jobs.filter(j => j.status === 'queued');
  for (const job of pending) await dispatch(job);
  return { ok: true, dispatched: pending.length, control_plane: 'vercel' };
}
