import { logNodeRuntimeVersion } from '../lib/node-runtime-version.mjs';

import { mayReadJob } from '../lib/hubControlAuth.mjs';
import { readState, publicJob } from '../lib/hubJobState.mjs';
import { detailedJob } from '../lib/hubJobResults.mjs';

logNodeRuntimeVersion('hub/api/job_status');

export default { async fetch(request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    if (request.method !== 'POST') return Response.json({ ok: false }, { status: 405, headers });
    const { id, status_token } = await request.json();
    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '') || status_token || '';
    if (!mayReadJob(token, id)) return Response.json({ ok: false, error: '工作授權已過期，請重新載入管理頁。' }, { status: 401, headers });
    const { state } = await readState();
    if (id === 'admin-jobs') {
      const jobs = [...state.jobs].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,20).map(j => publicJob(j, false));
      return Response.json({ ok: true, jobs }, { headers });
    }
    const job = publicJob(await detailedJob(state.jobs.find(j => j.id === id)));
    return Response.json({ ok: Boolean(job), job }, { status: job ? 200 : 404, headers });
  } catch (error) {
    console.error('hub_job_status_failed', error.message);
    return Response.json({ ok: false, error: '工作進度暫時無法讀取。' }, { status: 503, headers });
  }
} };
