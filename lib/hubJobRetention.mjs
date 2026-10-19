/** Active jobs are stored first, so array position is not historical order. */
export function retainJobHistory(jobs) {
  const active = jobs.filter(job => ['queued', 'running'].includes(job.status));
  const completed = jobs.filter(job => !['queued', 'running'].includes(job.status));
  completed.sort((left, right) => left.created_at.localeCompare(right.created_at));
  return [...active, ...completed.slice(-25)];
}
