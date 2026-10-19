import { useEffect, useRef } from 'react';
import { intelApiUrl } from './api';
import { readJson } from './jsonRequest';

/** Poll a tiny CDN-cached version, never the database or private admin feed. */
export function usePublicationRefresh(onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    let previous = '';
    const controller = new AbortController();
    let inFlight = false;
    const check = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const value = await readJson(intelApiUrl('/api/public/version'), {
          cache: 'default', credentials: 'omit', signal: controller.signal, timeoutMs: 12_000,
        }) as { ok?: boolean; feed?: number; wiki?: number };
        if (!value.ok) return;
        const version = `${value.feed}:${value.wiki}`;
        if (previous && previous !== version) callback.current();
        previous = version;
      } catch (error) {
        if (!controller.signal.aborted) console.warn('Publication update check failed');
      } finally { inFlight = false; }
    };
    void check();
    const interval = window.setInterval(() => { void check(); }, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort(); window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
}
