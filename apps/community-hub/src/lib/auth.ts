import { intelApiUrl } from "@/lib/api";

export interface HubAuthState {
  authenticated: boolean;
  mode: string;
  permissions: { admin: boolean; wiki_edit: boolean };
  profile: {
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
    twitter_username?: string | null;
  };
  provider: string;
  renaiss_sso_configured: boolean;
  role: string;
  user: string;
}

export const EMPTY_AUTH_STATE: HubAuthState = {
  authenticated: false,
  mode: "protected",
  permissions: { admin: false, wiki_edit: false },
  profile: {},
  provider: "",
  renaiss_sso_configured: false,
  role: "",
  user: "",
};

function normalizeAuth(payload: Partial<HubAuthState>): HubAuthState {
  return {
    ...EMPTY_AUTH_STATE,
    ...payload,
    permissions: { ...EMPTY_AUTH_STATE.permissions, ...(payload.permissions ?? {}) },
    profile: { ...(payload.profile ?? {}) },
  };
}

export async function readAuthState(): Promise<HubAuthState> {
  const response = await fetch(intelApiUrl("/api/auth/me"), { cache: "no-store", credentials: "include" });
  const payload = await response.json().catch(() => ({})) as Partial<HubAuthState> & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
  return normalizeAuth(payload);
}

export function renaissLoginUrl(): string {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return intelApiUrl(`/api/auth/renaiss/start?return_to=${encodeURIComponent(current)}`);
}

export async function logout(): Promise<HubAuthState> {
  const response = await fetch(intelApiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const payload = await response.json().catch(() => ({})) as Partial<HubAuthState> & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
  return normalizeAuth(payload);
}
