import { request } from 'node:https';
import { lanes, jobLane } from './hubJobLanes.mjs';

/** Batch requests may take minutes before response headers are ready. Node's
 * built-in fetch has a separate 300s headers timeout, regardless of its abort
 * signal. Use the HTTPS client with one explicit end-to-end deadline instead.
 */
export function requestBatch(origin, secret, scheduled, prepareOnly = false, deadlineMs = 1_650_000) {
  return requestPayload(origin, secret, { scheduled, prepare_only: prepareOnly }, deadlineMs);
}

export function requestJob(origin, secret, job) {
  return requestPayload(origin, secret, { job }, 1_650_000, lanes[jobLane(job)].endpoint);
}

function requestPayload(origin, secret, payload, deadlineMs, endpoint = '/api/run_jobs') {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const timer = setTimeout(() => outgoing.destroy(new Error('Batch request exceeded its deadline')), deadlineMs);
    const outgoing = request(new URL(endpoint, origin), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, incoming => {
      let raw = '';
      incoming.setEncoding('utf8');
      incoming.on('data', chunk => {
        raw += chunk;
        if (raw.length > 1_000_000) outgoing.destroy(new Error('Batch response exceeded its size limit'));
      });
      incoming.on('error', error => { clearTimeout(timer); reject(error); });
      incoming.on('aborted', () => { clearTimeout(timer); reject(new Error('Batch response aborted')); });
      incoming.on('end', () => {
        clearTimeout(timer);
        try { resolve({ status: incoming.statusCode, result: JSON.parse(raw) }); }
        catch { reject(new Error('Batch response was not valid JSON')); }
      });
    });
    outgoing.on('error', error => { clearTimeout(timer); reject(error); });
    outgoing.end(body);
  });
}
