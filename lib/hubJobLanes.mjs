/** Query capacity is independent of the single content writer. Persist the lane
 * because completed control records intentionally discard their input. */
export const lanes = Object.freeze({
  mutation: { topic: 'hub-mutations-v1', concurrency: 1, endpoint: '/api/run_jobs' },
  agent: { topic: 'hub-agent-v1', concurrency: 2, endpoint: '/api/run_agent' },
});

export function jobLane(job) {
  return job.lane || (job.kind === 'action' && job.input?.path === '/api/intel/agent' ? 'agent' : 'mutation');
}

export function claimInState(state, id, lane, now, owner) {
  if (!lanes[lane]) throw new Error('Unsupported job lane');
  const job = state.jobs.find(j => j.id === id);
  if (!job) throw new Error('Unknown queued job');
  if (jobLane(job) !== lane) throw new Error('Job delivered to the wrong consumer');
  if (job.status !== 'queued') return null; // Never replay an uncertain AI run.
  const active = state.jobs.filter(j => jobLane(j) === lane && j.status === 'running' && j.deadline > now);
  if (active.length >= lanes[lane].concurrency) throw new Error('Job lane is at capacity: ' + lane);
  Object.assign(job, { lane, status: 'running', owner, started_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(), deadline: now + 1_920_000, attempts: (job.attempts || 0) + 1 });
  return job;
}
