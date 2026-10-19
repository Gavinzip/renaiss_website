import { intelApiUrl } from '@/lib/api';

export interface PipelineEnvelope {
  ok?: boolean;
  error?: string;
  job?: { id: string; status: string; status_token?: string; message?: string; error?: string; response?: Record<string, unknown> | null };
}

export async function completePipelineRequest<T extends PipelineEnvelope>(payload: T, signal?: AbortSignal): Promise<T> {
  if (!payload.job?.id) return payload;
  const id = payload.job.id;
  const statusToken = payload.job.status_token;
  if (!statusToken) throw new Error('缺少工作進度授權，請重新載入頁面。');
  const until = Date.now() + 35 * 60 * 1000;
  while (Date.now() < until) {
    if (signal?.aborted) throw new DOMException('Aborted','AbortError');
    if (payload.job?.status === 'done') return { ...payload, ...payload.job.response };
    if (payload.job?.status === 'failed') throw new Error(payload.job.error || payload.job.message || '背景工作失敗');
    await new Promise(resolve => window.setTimeout(resolve, 5000));
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort',cancel,{once:true});
    const timer = window.setTimeout(cancel,20000);
    try {
      const response = await fetch(intelApiUrl('/api/intel/job-status'), { method:'POST',cache:'no-store',credentials:'include',headers:{'Content-Type':'application/json', Authorization:`Bearer ${statusToken}`} ,body:JSON.stringify({id}),signal:controller.signal });
      payload = await response.json() as T;
      if (!response.ok || payload.ok===false) throw new Error(payload.error || `HTTP ${response.status}`);
    } finally { window.clearTimeout(timer); signal?.removeEventListener('abort',cancel); }
  }
  throw new Error('背景工作尚未完成，請從管理頁查看進度。');
}
