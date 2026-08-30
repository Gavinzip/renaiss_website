import type { FeedCard, Language } from "@/types";

export const PROJECTS = [
  { id: "tcg", icon: "layers-3", account: "renaissxyz" },
  { id: "index", icon: "chart-no-axes-combined", account: "renaiss_index" },
  { id: "defi", icon: "landmark", account: "renaiss_fi" },
  { id: "game", icon: "gamepad-2", account: "vinciwld" },
  { id: "hackathon", icon: "code-2", account: "tastedotmd" },
  { id: "outreach", icon: "megaphone", account: "renaissCLTB" },
] as const;

export type ProjectId = (typeof PROJECTS)[number]["id"];
export type AccountProjectMap = Record<string, string>;

export function normalizeProjectAccount(value: unknown): string {
  return String(value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

export function isProjectId(value: unknown): value is ProjectId {
  return PROJECTS.some((project) => project.id === value);
}

export function projectIdForAccount(account: unknown, accountProjects: AccountProjectMap = {}): ProjectId | "" {
  const normalized = normalizeProjectAccount(account);
  if (!normalized) return "";
  const entry = Object.entries(accountProjects).find(([key]) => normalizeProjectAccount(key) === normalized);
  return isProjectId(entry?.[1]) ? entry[1] : "";
}

export function projectIdForCard(card: FeedCard, accountProjects: AccountProjectMap = {}): ProjectId | "" {
  return projectIdForAccount(card.account, accountProjects);
}

export function projectLabel(projectId: ProjectId, _lang: Language): string {
  const project = PROJECTS.find((item) => item.id === projectId);
  return project ? `@${project.account}` : "";
}
