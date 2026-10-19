import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { randomUUID, createHash } from 'node:crypto';
import { statusToken } from './hubControlAuth.mjs';
import { saveDetails, compactResult } from './hubJobResults.mjs';
import { claimInState, jobLane } from './hubJobLanes.mjs';
import { retainJobHistory } from './hubJobRetention.mjs';

const path = 'hub-control/jobs-v1.json';
const stamp = () => new Date().toISOString();
const validKinds = new Set(['sync', 'analyze_url', 'reanalyze', 'translate', 'action', 'metrics', 'backup', 'restore']);

export function publicJob(job, grant = true) {
  if (!job) return null;
  const { owner, deadline, result_path, input, ...value } = job;
  return { ...value, ...(job.result || {}), message: job.error || job.phase || job.status, ...(grant ? { status_token: statusToken(job.id) } : {}) };
}

export async function readState() {
  // Compressed HTTP representations have a weak ETag, unsuitable for If-Match.
  // Request the identity representation so the body and strong ETag agree.
  const value = await get(path, { access: 'private', useCache: false, headers: { 'Accept-Encoding': 'identity' } });
  if (!value) return { state: { schema: 1, jobs: [] }, etag: null };
  if (!value.blob.etag || value.blob.etag.startsWith('W/')) throw new Error('Job controls require a strong Blob ETag');
  const state = await new Response(value.stream).json();
  if (state.schema !== 1 || !Array.isArray(state.jobs)) throw new Error('Invalid Vercel job control state');
  return { state, etag: value.blob.etag };
}

/** Conditional Blob writes serialize controls across instances and deployments. */
export async function mutate(operation) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const { state, etag } = await readState();
    const before = JSON.stringify(state);
    const result = operation(state);
    state.jobs = retainJobHistory(state.jobs);
    if (state.jobs.length > 100) throw new Error('Job queue capacity exceeded');
    const body = JSON.stringify(state);
    if (body === before) return result;
    try {
      await put(path, body, {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
      });
      console.log(JSON.stringify({ event: 'hub_control_blob_write', bytes: Buffer.byteLength(body), attempt: attempt + 1 }));
      return result;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) && !/already exists|conditional request.*conflicting operation/i.test(error.message)) throw error;
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 120));
    }
  }
  throw new Error('Concurrent job state update did not settle');
}

export async function enqueue(kind, input, user, scheduled = false) {
  if (!validKinds.has(kind) || !input || typeof input !== 'object') throw new Error('Unsupported job');
  if (Buffer.byteLength(JSON.stringify(input)) > 500_000) throw new Error('Job input is too large');
  const slot = Math.floor(Date.now() / 1_800_000);
  const result = await mutate(state => {
    for (const job of state.jobs) {
      if (job.status === 'running' && job.deadline < Date.now()) {
        Object.assign(job, { status: 'failed', error: 'Worker interrupted; explicitly retry after checking publication', finished_at: stamp(), updated_at: stamp() });
      }
    }
    const key = JSON.stringify(input);
    const existing = state.jobs.find(j => j.kind === kind && ['queued', 'running'].includes(j.status) && (scheduled || (j.created_by === user && JSON.stringify(j.input) === key)));
    if (existing) return existing;
    const id = scheduled ? createHash('sha256').update(`source-sync:${slot}`).digest('hex').slice(0, 32) : randomUUID().replaceAll('-', '');
    const same = state.jobs.find(j => j.id === id);
    if (same) return same;
    const job = { id, kind, input, created_by: user, status: 'queued', phase: '', created_at: stamp(), updated_at: stamp(), control_plane: 'vercel', attempts: 0 };
    job.lane = jobLane(job);
    state.jobs.push(job);
    return job;
  });
  return publicJob(result);
}

export async function claim(id, lane = 'mutation') {
  return mutate(state => claimInState(state, id, lane, Date.now(), randomUUID()));
}

export async function update(id, owner, patch) {
  let details;
  if (patch.status) {
    const { state } = await readState();
    const job = state.jobs.find(j => j.id === id);
    if (!job || job.owner !== owner || job.status !== 'running') throw new Error('Worker no longer owns this job');
    details = await saveDetails(job, patch);
  }
  return mutate(state => {
    const job = state.jobs.find(j => j.id === id);
    if (!job || job.owner !== owner || job.status !== 'running' || job.deadline < Date.now()) throw new Error('Worker no longer owns this job');
    for (const key of Object.keys(patch)) if (!['phase', 'status', 'error', 'result', 'metrics'].includes(key)) throw new Error('Invalid job update');
    if (patch.status && !['done', 'failed'].includes(patch.status)) throw new Error('Invalid terminal job status');
    Object.assign(job, patch, { updated_at: stamp() });
    if (['done', 'failed'].includes(job.status)) {
      job.finished_at = stamp(); job.result_path = details;
      job.result = compactResult(patch.result);
      job.metrics = { processing_seconds: patch.metrics?.processing_seconds };
      delete job.input;
    }
    return publicJob(job);
  });
}
