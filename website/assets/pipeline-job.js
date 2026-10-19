/* Shared queued-response contract for the existing website pages. */
(() => {
  window.renaissCompletePipelineRequest = async (payload, options = {}) => {
    if (!payload?.job?.id) return payload;
    let job = payload.job;
    const statusToken = job.status_token;
    if (!statusToken) throw new Error('缺少工作進度授權，請重新載入頁面。');
    const deadline = Date.now() + 35 * 60 * 1000;
    while (Date.now() < deadline) {
      if (job.status === 'done') return { ...payload, ...job.response };
      if (job.status === 'failed') throw new Error(job.error || job.message || '背景工作失敗');
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      await new Promise(resolve => setTimeout(resolve, 5000));
      const response = await fetch('/api/intel/job-status', {
        method: 'POST', cache: 'no-store', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${statusToken}` },
        body: JSON.stringify({ id: job.id }), signal: options.signal || AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || !result.job) throw new Error(result.error || '工作狀態讀取失敗');
      job = result.job;
    }
    throw new Error('背景工作仍在執行，請從管理頁查看。');
  };
})();
