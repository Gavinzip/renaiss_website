import { internal, statusToken } from '../lib/hubControlAuth.mjs';
import { enqueue, readState, publicJob, update } from '../lib/hubJobState.mjs';
import { dispatch } from '../lib/hubJobQueue.mjs';
import { detailedJob } from '../lib/hubJobResults.mjs';

export default { async fetch(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST' || !internal(request)) return Response.json({ ok: false }, { status: 401, headers });
  try {
    const data = await request.json();
    let result;
    if (data.op === 'enqueue') {
      result = await enqueue(data.kind, data.input, data.user);
      await dispatch(result);
    } else if (data.op === 'update') result = await update(data.id, data.owner, data.patch);
    else if (data.op === 'get') {
      const { state } = await readState();
      // This internal representation is never sent by the public status route.
      result = await detailedJob(state.jobs.find(j => j.id === data.id)) || null;
    } else if (data.op === 'dashboard') {
      const { state } = await readState();
      result = { status_token: statusToken('admin-jobs'), jobs: [...state.jobs].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,20).map(j => publicJob(j, false)) };
    } else if (data.op === 'recent') {
      const { state } = await readState();
      result = [...state.jobs].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,20).map(j => publicJob(j, false));
    } else if (data.op === 'schedules') result = [{ name: 'source-sync', enabled: true, interval_seconds: 1800, next_run_at: new Date((Math.floor(Date.now()/1_800_000)+1)*1_800_000).toISOString() }];
    else throw new Error('Unknown control operation');
    return Response.json({ ok: true, result }, { headers });
  } catch (error) {
    console.error('hub_control_failed', error.message);
    return Response.json({ ok: false, error: 'Vercel job control unavailable' }, { status: 503, headers });
  }
} };
