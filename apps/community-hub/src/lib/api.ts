const DEFAULT_INTEL_API_BASE = "https://renaiss.zeabur.app";

function isLocalPreviewHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

/**
 * The Hub is published both through the local preview server and the static
 * frontend package. Local hosts keep relative paths so Vite and the preview
 * server can proxy the API; published builds use the established Intel origin.
 */
export function intelApiUrl(path: string): string {
  if (typeof window === "undefined" || isLocalPreviewHost(window.location.hostname)) return path;
  return `${DEFAULT_INTEL_API_BASE}${path}`;
}
