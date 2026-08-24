import { isSbt, safeUrl, toDate } from "@/lib/feed";
import type { FeedCard } from "@/types";

const ACTION_PATTERN = /(取得|獲得|获得|領取|领取|解鎖|解锁|空投|快照|達到|达到|完成|報名|报名|參與|参与|購買|购买|抽|開出|开出|追蹤|追踪|提交|張貼|张贴|前往|表單|表单|造訪|造访|pull|open|claim|airdrop|snapshot|unlock|buy)/i;
const NON_ACTIONABLE_PATTERN = /^(依官方|以原文|待官方|原文未明確|请看原文|請看原文)/;
const CLOSED_PATTERN = /(全數.*(?:認領|认领|售出)|認領完畢|认领完毕|售罄|售完|已截止|報名截止|报名截止|活動已結束|活动已结束|領取結束|领取结束|已完成配發|已完成配发|sold\s*out|claim(?:ing)?\s*(?:has\s*)?(?:ended|closed)|registration\s*closed)/i;
const TIME_BOUND_PATTERN = /(活動|活动|賽事|赛事|比賽|比赛|報名|报名|錦標賽|锦标赛|前\s*100|前百|top\s*100|poker|tetris|showdown|tournament)/i;

export type SbtSignalStatus = "pending" | "claimable" | "expired";

export interface SbtAcquisitionSignal {
  acquisition: string;
  date: string;
  name: string;
  publishedAt: string;
  source: string;
  status: SbtSignalStatus;
  title: string;
}

interface InlineSbtEntry {
  acquisition: string;
  name: string;
}

interface CandidateRow extends SbtAcquisitionSignal {
  sortTime: number;
}

function compact(value: unknown, limit = 128): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : normalized;
}

function normalizeSbtText(value: unknown, limit = 128): string {
  return compact(String(value ?? "")
    .replace(/^\s*SBT\s*(取得方式|获取方式|acquisition|획득 방법)\s*[:：]\s*/i, ""), limit);
}

function normalizeMethod(value: unknown, limit = 160): string {
  return normalizeSbtText(String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s*(連結為|链接为|連結在文內|链接在文内)\s*$/i, "")
    .replace(/[，,；;]\s*$/g, ""), limit);
}

function detailLines(card: FeedCard): string[] {
  return [...(card.detail_lines ?? []), ...(card.bullets ?? [])]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function firstDetailValue(card: FeedCard, patterns: RegExp[], limit = 128): string {
  for (const line of detailLines(card)) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const value = normalizeSbtText(line.slice(match[0].length), limit);
      if (value) return value;
    }
  }
  return "";
}

function extractSbtName(value: unknown): string {
  const normalized = normalizeSbtText(value, 96);
  const match = normalized.match(/\b([A-Za-z0-9][A-Za-z0-9 +'._-]{1,54}\s+(?:SBT|Soul\s*Bound\s*Token))\b/i);
  return match ? normalizeSbtText(match[1], 64) : "";
}

function weakSbtName(value: unknown): boolean {
  const normalized = compact(value, 96);
  if (!normalized || !/(sbt|soulbound|認證|认证|徽章|badge)/i.test(normalized)) return true;
  return /^(#?\d+\s*)?(個|个)?\s*sbt$/i.test(normalized)
    || /^的\s*sbt$/i.test(normalized)
    || /^(此結果代表|目前共有|同步釋出|對應|已結束的).*sbt$/i.test(normalized);
}

function actionableMethod(value: unknown): boolean {
  const normalized = normalizeMethod(value);
  if (!normalized || NON_ACTIONABLE_PATTERN.test(normalized)) return false;
  if (/(top value|packs only|lands tomorrow|cards to hunt|here are the top|https?:\/\/)/i.test(normalized)) return false;
  return ACTION_PATTERN.test(normalized);
}

function parseInlineEntry(line: string): InlineSbtEntry | null {
  const normalized = normalizeSbtText(line, 260);
  if (!normalized || !/(sbt|soul\s*bound\s*token|徽章|badge)/i.test(normalized)) return null;
  const match = normalized.match(/^\s*(?:[-*•]\s*)?([^:：]{2,110}?(?:\bSBT\b|\bSoul\s*Bound\s*Token\b|徽章|badge)[^:：]{0,28})\s*[:：]\s*(.{2,180})$/i);
  if (!match) return null;
  const left = normalizeSbtText(match[1], 96);
  if (/^SBT\s*(?:取得方式|获取方式|acquisition|획득 방법|名稱|名称)\b/i.test(left)) return null;
  const name = extractSbtName(left) || left;
  const acquisition = normalizeMethod(match[2]);
  return !weakSbtName(name) && actionableMethod(acquisition) ? { name, acquisition } : null;
}

function inlineEntries(card: FeedCard): InlineSbtEntry[] {
  const seen = new Set<string>();
  return detailLines(card)
    .map(parseInlineEntry)
    .filter((entry): entry is InlineSbtEntry => Boolean(entry))
    .filter((entry) => {
      const key = `${entry.name}\u0000${entry.acquisition}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function unlockCondition(card: FeedCard): string {
  return firstDetailValue(card, [/^\s*SBT\s*(?:解鎖條件|解锁条件)\s*[:：]\s*/i], 160);
}

function namesFromUnlockCondition(value: unknown): string[] {
  const normalized = normalizeSbtText(value, 180);
  const names = [...normalized.matchAll(/\b([A-Za-z0-9][A-Za-z0-9 +'._-]{1,54}\s+SBT)\b/gi)].map((match) => match[1]);
  return [...new Set(names.map((name) => normalizeSbtText(name, 64)).filter((name) => !weakSbtName(name)))].slice(0, 4);
}

function namesForCard(card: FeedCard): string[] {
  const names = [...(card.sbt_names ?? []), card.sbt_name]
    .map((value) => normalizeSbtText(value, 64))
    .filter((value) => !weakSbtName(value));
  if (!names.length) {
    const named = firstDetailValue(card, [/^\s*SBT\s*(?:名稱|名称)\s*[:：]\s*/i], 96);
    const reward = firstDetailValue(card, [/^\s*(?:獎勵|奖励)\s*[:：]\s*/i], 96);
    names.push(extractSbtName(named) || named, extractSbtName(reward), ...namesFromUnlockCondition(unlockCondition(card)), ...inlineEntries(card).map((entry) => entry.name));
  }
  return [...new Set(names.map((name) => normalizeSbtText(name, 64)).filter((name) => !weakSbtName(name)))].slice(0, 4);
}

function acquisitionForCard(card: FeedCard): string {
  let acquisition = normalizeMethod(card.sbt_acquisition);
  if (!acquisition) acquisition = normalizeMethod(firstDetailValue(card, [/^\s*SBT\s*(?:取得方式|获取方式|acquisition|획득 방법)\s*[:：]\s*/i], 160));
  if (!acquisition) {
    const parts = [
      firstDetailValue(card, [/^\s*(?:領取條件|领取条件|取得條件|获取条件)\s*[:：]\s*/i], 96),
      firstDetailValue(card, [/^\s*(?:參與方式|参与方式)\s*[:：]\s*/i], 96),
      firstDetailValue(card, [/^\s*(?:操作流程)\s*[:：]\s*/i], 96),
      unlockCondition(card),
    ].map((value) => normalizeMethod(value, 96)).filter(Boolean);
    acquisition = [...new Set(parts)].slice(0, 2).join("；");
  }
  if (!acquisition) acquisition = inlineEntries(card).map((entry) => `${entry.name}：${entry.acquisition}`).join("；");
  return actionableMethod(acquisition) ? acquisition : "";
}

function deadline(card: FeedCard): string {
  const explicit = firstDetailValue(card, [/^\s*(?:截止日期|截止時間|截止时间)\s*[:：]\s*/i], 96);
  const match = explicit.match(/\b(20\d{2})[-/.年]\s*(\d{1,2})[-/.月]\s*(\d{1,2})\s*日?\b/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : "";
}

function cardEvidence(card: FeedCard): string {
  return [card.title, card.summary, card.glance, card.raw_text, ...detailLines(card)].filter(Boolean).join(" ");
}

function signalStatus(card: FeedCard, acquisition: string): Pick<CandidateRow, "date" | "sortTime" | "status"> {
  const explicitEnd = String(card.timeline_end_date || deadline(card)).trim();
  const timelineDate = String(card.timeline_date || "").trim();
  const publishedAt = String(card.published_at ?? "").trim();
  const displayDate = explicitEnd || timelineDate || publishedAt;
  const sortDate = toDate(displayDate) || toDate(publishedAt);
  const sortTime = Number(sortDate ?? 0);
  const evidence = cardEvidence(card);

  if (explicitEnd) {
    const endDate = toDate(explicitEnd);
    if (!endDate) return { date: displayDate, sortTime, status: "pending" };
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    return { date: displayDate, sortTime, status: endOfDay.valueOf() < Date.now() ? "expired" : "claimable" };
  }

  if (CLOSED_PATTERN.test(evidence)) return { date: displayDate, sortTime, status: "expired" };

  const datedEvent = toDate(timelineDate);
  if (datedEvent && TIME_BOUND_PATTERN.test(evidence)) {
    const endOfDay = new Date(datedEvent);
    endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay.valueOf() < Date.now()) return { date: displayDate, sortTime, status: "expired" };
  }

  return { date: displayDate, sortTime, status: actionableMethod(acquisition) ? "claimable" : "pending" };
}

function rowsForCard(card: FeedCard): CandidateRow[] {
  const source = safeUrl(card.url);
  const publishedAt = String(card.published_at ?? "").trim();
  if (!source || !publishedAt) return [];
  const inline = inlineEntries(card);
  const hasStructured = Boolean(String(card.sbt_acquisition || card.sbt_name || "").trim()) || Boolean(card.sbt_names?.some((value) => String(value ?? "").trim()));
  const shared = { publishedAt, source, title: String(card.title ?? "Renaiss") };
  if (!hasStructured && inline.length) return inline.map((entry) => ({ ...shared, ...entry, ...signalStatus(card, entry.acquisition) }));
  const names = namesForCard(card);
  const acquisition = acquisitionForCard(card);
  return names.length ? [{ ...shared, acquisition, name: names.join(" / "), ...signalStatus(card, acquisition) }] : [];
}

function betterRow(current: CandidateRow, incoming: CandidateRow): CandidateRow {
  if (incoming.acquisition.length !== current.acquisition.length) return incoming.acquisition.length > current.acquisition.length ? incoming : current;
  const currentLive = current.status === "expired" ? 0 : 1;
  const incomingLive = incoming.status === "expired" ? 0 : 1;
  if (incomingLive !== currentLive) return incomingLive > currentLive ? incoming : current;
  return incoming.sortTime >= current.sortTime ? incoming : current;
}

export function sbtAcquisitionSignals(cards: FeedCard[]): SbtAcquisitionSignal[] {
  const recentAfter = new Date();
  recentAfter.setDate(recentAfter.getDate() - 30);
  const grouped = new Map<string, CandidateRow>();

  cards.filter(isSbt).forEach((card) => {
    const publishedAt = toDate(card.published_at);
    if (!publishedAt || publishedAt < recentAfter) return;
    rowsForCard(card).forEach((row) => {
      const key = row.name.toLowerCase();
      const previous = grouped.get(key);
      grouped.set(key, previous ? betterRow(previous, row) : row);
    });
  });

  return [...grouped.values()]
    .sort((left, right) => right.sortTime - left.sortTime)
    .slice(0, 10)
    .map(({ sortTime: _sortTime, ...row }) => row);
}
