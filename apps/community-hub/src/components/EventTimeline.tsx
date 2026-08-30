import { CardMedia } from "@/components/ContentCard";
import { Icon } from "@/components/Icon";
import { InlineCardAdmin } from "@/components/admin/InlineCardAdmin";
import { eventStatus, formatDate, safeUrl, toDate } from "@/lib/feed";
import { text } from "@/lib/copy";
import { eventRegion, eventRegionLabel, isRegionalCommunitySource, preferredEventRegion } from "@/lib/regions";
import type { EventStatus, FeedCard, Language } from "@/types";

interface EventTimelineProps {
  cards: FeedCard[];
  lang: Language;
  onOpenArticle: (source: string) => void;
}

type EventTimelineItemProps = Omit<EventTimelineProps, "cards"> & { card: FeedCard };

function localeFor(lang: Language): string {
  if (lang === "zh-Hans") return "zh-CN";
  if (lang === "ko") return "ko-KR";
  if (lang === "en") return "en-US";
  return "zh-TW";
}

function eventDate(card: FeedCard): Date | null {
  return toDate(card.timeline_date) ?? toDate(card.published_at);
}

function compactDate(card: FeedCard, lang: Language): string {
  const date = eventDate(card);
  return date?.toLocaleDateString(localeFor(lang), { month: "2-digit", day: "2-digit" }) ?? "--";
}

function dateContext(card: FeedCard, lang: Language): string {
  const date = eventDate(card);
  if (!date) return "";
  const locale = localeFor(lang);
  const year = date.toLocaleDateString(locale, { year: "numeric" });
  const weekday = date.toLocaleDateString(locale, { weekday: "short" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((dateDay.valueOf() - today.valueOf()) / 86_400_000);
  if (Math.abs(difference) > 30) return `${year} · ${weekday}`;
  const relative = relativeDayLabel(lang, difference);
  return `${relative} · ${weekday}`;
}

function relativeDayLabel(lang: Language, difference: number): string {
  if (lang === "en") {
    if (difference === 0) return "Today";
    if (difference === 1) return "Tomorrow";
    if (difference === -1) return "Yesterday";
    return difference > 0 ? `In ${difference} days` : `${Math.abs(difference)} days ago`;
  }
  if (lang === "ko") {
    if (difference === 0) return "오늘";
    if (difference === 1) return "내일";
    if (difference === -1) return "어제";
    return difference > 0 ? `${difference}일 후` : `${Math.abs(difference)}일 전`;
  }
  if (difference === 0) return "今天";
  if (difference === 1) return "明天";
  if (difference === -1) return "昨天";
  if (lang === "zh-Hans") return difference > 0 ? `${difference} 天后` : `${Math.abs(difference)} 天前`;
  return difference > 0 ? `${difference} 天後` : `${Math.abs(difference)} 天前`;
}

function dateRange(card: FeedCard, lang: Language): string {
  const start = card.timeline_date || card.published_at;
  const end = card.timeline_end_date;
  if (!end || formatDate(start, lang) === formatDate(end, lang)) return formatDate(start, lang);
  return `${formatDate(start, lang)} - ${formatDate(end, lang)}`;
}

function statusLabel(lang: Language, status: EventStatus): string {
  return text(lang, `card.${status}`);
}

function EventTimelineItem({ card, lang, onOpenArticle }: EventTimelineItemProps) {
  const source = safeUrl(card.url);
  const excerpt = card.bullets?.find((line) => line.trim()) ?? "";
  const status = eventStatus(card);
  const region = eventRegion(card);
  const preferred = region.id === preferredEventRegion(lang);
  const openArticle = () => {
    if (source) onOpenArticle(source);
  };

  return <li className={`community-hub-event-timeline-item is-${status} ${preferred ? "is-local-region" : "is-other-region"}`}>
    <div className="community-hub-event-date">
      <span className="community-hub-event-date-dot" aria-hidden="true" />
      <time dateTime={String(card.timeline_date || card.published_at || "")}>
        <strong>{compactDate(card, lang)}</strong>
        <small>{dateContext(card, lang)}</small>
      </time>
      <span className={`community-hub-event-state is-${status}`}>{statusLabel(lang, status)}</span>
      {card.manual_pin ? <span className="community-hub-event-pin"><Icon name="pin" />{text(lang, "card.pinned")}</span> : null}
    </div>

    <button type="button" className="community-hub-event-media-button" onClick={openArticle} disabled={!source} aria-label={card.title || "Renaiss"}>
      <CardMedia card={card} className="community-hub-event-media" label={text(lang, "card.defaultCover")} />
    </button>

    <div className="community-hub-event-copy">
      <div className="community-hub-event-meta">
        <span>@{String(card.account || "source").replace(/^@+/, "")} · {isRegionalCommunitySource(card) ? text(lang, "card.regional") : text(lang, "card.official")}</span>
        <span className="community-hub-event-region"><Icon name="map-pin" />{eventRegionLabel(card, lang)}</span>
        <time dateTime={String(card.timeline_date || card.published_at || "")}>{dateRange(card, lang)}</time>
      </div>
      <h3><button type="button" onClick={openArticle} disabled={!source}>{card.title || "Renaiss"}</button></h3>
      <p>{card.summary || card.glance || ""}</p>
      <footer>
        {excerpt ? <span>{excerpt}</span> : <span />}
        {source ? <div>
          <button type="button" onClick={openArticle}>{text(lang, "action.hub")}<Icon name="arrow-right" /></button>
          <a href={source} target="_blank" rel="noreferrer">{text(lang, "action.original")}<Icon name="arrow-up-right" /></a>
        </div> : null}
      </footer>
    </div>
    <InlineCardAdmin card={card} />
  </li>;
}

export function EventTimeline({ cards, lang, onOpenArticle }: EventTimelineProps) {
  return <ol className="community-hub-event-timeline">
    {cards.map((card) => <EventTimelineItem key={card.url ?? `${card.title}-${card.published_at}`} card={card} lang={lang} onOpenArticle={onOpenArticle} />)}
  </ol>;
}
