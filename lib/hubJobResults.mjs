import { get, put } from '@vercel/blob';

/** Completed details are read once by their caller, never on every progress poll. */
export async function saveDetails(job, patch) {
  const blob = await put(`hub-control/results/${job.id}.json`, JSON.stringify({
    input: job.input, result: patch.result || null, metrics: patch.metrics || {},
  }), { access: 'private', contentType: 'application/json', addRandomSuffix: true });
  return blob.url;
}

export async function detailedJob(job) {
  if (!job?.result_path) return job;
  const blob = await get(job.result_path, { access: 'private', useCache: false });
  if (!blob) throw new Error('Completed job details are unavailable');
  const value = await new Response(blob.stream).json();
  return { ...job, ...value };
}

export function compactResult(result) {
  if (!result) return null;
  return Object.fromEntries(['revision','message','changed_files','needs_translation'].filter(k => result[k] !== undefined).map(k => [k,result[k]]));
}
