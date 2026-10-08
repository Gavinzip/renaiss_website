// Shared by the original aggregator and Community Hub. Keep pairing and the
// Taipei weekly earning gate in one place, independently of article rendering.
import { limitedPackSbtCopy } from "./limited-pack-sbt-copy.js";
export { limitedPackSbtCopy };

function date(value) {
  if (!value) return null;
  const result = new Date(value);
  return Number.isFinite(result.valueOf()) ? result : null;
}

function officialPostUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /^(?:x|twitter)\.com$/.test(url.hostname)
      && /^\/renaissxyz\/status\/\d+\/?$/.test(url.pathname) ? url.href : "";
  } catch { return ""; }
}

const DAY = 86_400_000;
const TAIPEI_OFFSET = 8 * 3_600_000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CLOSED = /\bsold\s*out\b|\b(?:ended|closed|cancelled|canceled|paused|suspended)\b|售罄|已結束|已结束|取消|暫停|暂停/i;
const LAUNCH = /\b(?:coming|arriving|launch(?:ing|es)?|opens?|go(?:es)? live)\b|開賣|开卖|開放|开放|上線|上线/i;

export function taipeiWeek(reference) {
  const shifted = new Date(reference.valueOf() + TAIPEI_OFFSET);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - (shifted.getUTCDay() + 6) % 7);
  const start = shifted.valueOf() - TAIPEI_OFFSET;
  return [start, start + 7 * DAY];
}

export function packInCurrentWindow(pack, reference) {
  const [weekStart, weekEnd] = taipeiWeek(reference);
  const start = date(pack.earning_start)?.valueOf();
  const end = date(pack.earning_end)?.valueOf();
  const now = reference.valueOf();
  if (start === undefined || start < weekStart || start >= weekEnd || pack.status === "ended" || (end !== undefined && end <= now)) return false;
  // A preview must never silently turn into an open machine when its date passes.
  return pack.status === "upcoming" ? start > now : start <= now;
}

function normalized(name) {
  return name.normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
}

function namedPack(raw) {
  const names = new Set([...raw.matchAll(/\b((?:[A-Z0-9]+\s+){1,4}PACK)\b/g)].map((match) => normalized(match[1]).replace(/^(?:(?:THE|NEW|OUR|INTRODUCING|LIMITED) )+/, "")));
  return names.size === 1 ? [...names][0] : "";
}

function closedPack(card, name) {
  return (card.raw_text ?? "").split(/[.!?。！？]/).some((statement) => normalized(statement).includes(name) && CLOSED.test(statement));
}

/** The feed's launch day must agree with a literal date and time in the source. */
function announcedStart(card) {
  const day = String(card.timeline_date ?? "");
  const parts = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const year = Number(parts[1]), month = Number(parts[2]), date = Number(parts[3]);
  if (month < 1 || month > 12) return null;
  const raw = card.raw_text ?? "";
  const literalDay = new RegExp(`(?:\\b${MONTHS[month - 1]}\\s+0?${date}(?:st|nd|rd|th)?\\b|(?<!\\d)0?${month}(?:/|月)0?${date}(?:日)?(?!\\d))`, "i");
  const quotedDay = literalDay.exec(raw);
  if (!quotedDay) return null;
  const afterDate = raw.slice(quotedDay.index + quotedDay[0].length, quotedDay.index + quotedDay[0].length + 65);
  const clock = afterDate.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*\(?UTC\s*([+-]\d{1,2})(?![\d:])\)?/i);
  if (!clock) return null;
  let hour = Number(clock[1]);
  const minute = Number(clock[2] ?? 0), offset = Number(clock[4]);
  if (clock[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (clock[3].toUpperCase() === "PM" ? 12 : 0);
  }
  if (hour > 23 || minute > 59 || Math.abs(offset) > 14) return null;
  const local = new Date(Date.UTC(year, month - 1, date, hour, minute));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== date) return null;
  return new Date(local.valueOf() - offset * 3_600_000).toISOString();
}

export function weeklyPackCampaigns(snapshot, cards, reference = new Date()) {
  if (snapshot.status !== "ready") return [];
  const [weekStart] = taipeiWeek(reference);
  const excluded = new Set(snapshot.non_limited_pack_names.map(normalized));
  const latest = new Map();
  const official = cards.filter((card) => card.account?.replace(/^@/, "").toLowerCase() === "renaissxyz")
    .filter((card) => (date(card.published_at)?.valueOf() ?? Infinity) <= reference.valueOf())
    .sort((a, b) => Number(date(b.published_at)) - Number(date(a.published_at)));
  for (const card of official) {
    const name = namedPack(card.raw_text ?? "");
    if (name && (closedPack(card, name) || LAUNCH.test(card.raw_text ?? "")) && !latest.has(name)) latest.set(name, card);
  }
  const current = snapshot.campaigns.filter((pack) => {
    if (!packInCurrentWindow(pack, reference)) return false;
    const update = latest.get(normalized(pack.name));
    return !update || !closedPack(update, normalized(pack.name)) || Number(date(update.published_at)) < Number(date(pack.earning_start));
  });
  for (const [name, card] of latest) {
    const raw = card.raw_text ?? "";
    const source = officialPostUrl(card.url);
    const published = date(card.published_at)?.valueOf();
    if (!source || published === undefined || published < weekStart - 7 * DAY || published > reference.valueOf()
      || excluded.has(name) || closedPack(card, name) || !LAUNCH.test(raw)) continue;
    const start = announcedStart(card);
    if (!start) continue;
    // Once this scheduled machine exists in the API, its state wins, including
    // a sold-out state. Its old announcement cannot resurrect it.
    if (snapshot.campaigns.some((pack) => normalized(pack.name) === name && date(pack.earning_start)?.valueOf() === Date.parse(start))) continue;
    const announcement = {
      id: `announcement-${card.id ?? source}`, name, status: "upcoming",
      earning_start: start, earning_end: null, source_url: source, badges: [], catalog_complete: false,
    };
    if (packInCurrentWindow(announcement, reference)) current.push(announcement);
  }
  return current.sort((a, b) => String(a.earning_start).localeCompare(String(b.earning_start)));
}

/** Each limited pack has two separate named earning tasks. Preview names follow
 * the agreed pack naming rule; only matched catalog rows are official definitions.
 */
export function packSbtPair(pack, lang) {
  const copy = limitedPackSbtCopy[lang];
  const base = pack.name.replace(/\s+PACK$/i, "");
  return ["first_pull", "s_card"].map((category) => {
    const official = pack.badges.find((badge) => badge.category === category) ?? null;
    const name = official ? (/\bSBT\b/i.test(official.name) ? official.name : `${official.name} SBT`)
      : category === "first_pull" ? `${pack.name} SBT` : `${base} S Tier SBT`;
    return { key: `${pack.id}:${category}`, name, category, pack_name: pack.name,
      acquisition: (category === "first_pull" ? copy.firstRule : copy.sRule).replace("{pack}", pack.name),
      official };
  });
}

export function packDateTime(value, lang) {
  if (!value) return limitedPackSbtCopy[lang].pendingDate;
  return new Intl.DateTimeFormat(lang, { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function validPackSnapshot(value) {
  const record = (row) => typeof row === "object" && row !== null;
  const validDate = (row) => row === null || (typeof row === "string" && Number.isFinite(Date.parse(row)));
  return record(value) && ["loading", "ready", "unavailable"].includes(value.status) && validDate(value.checked_at)
    && typeof value.valid_for_seconds === "number" && value.valid_for_seconds >= 0 && value.valid_for_seconds <= 150
    && Array.isArray(value.non_limited_pack_names) && value.non_limited_pack_names.every((name) => typeof name === "string")
    && Array.isArray(value.campaigns) && value.campaigns.every((pack) => record(pack)
      && typeof pack.id === "string" && typeof pack.name === "string" && ["open", "upcoming", "ended"].includes(pack.status)
      && validDate(pack.earning_start) && validDate(pack.earning_end) && pack.source_url === "https://www.renaiss.xyz/gacha"
      && typeof pack.catalog_complete === "boolean" && Array.isArray(pack.badges) && pack.badges.every((badge) => record(badge)
        && Number.isInteger(badge.id) && typeof badge.name === "string" && typeof badge.requirement === "string"
        && ["first_pull", "s_card", "special_tier"].includes(badge.category)));
}
