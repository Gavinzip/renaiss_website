import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { assets } from "@/data/legacy";
import { coverUrl, formatDate, isCommunity, isOfficial, safeUrl } from "@/lib/feed";
import { text } from "@/lib/copy";
import type { EventStatus, FeedCard, Language } from "@/types";
import { Icon } from "./Icon";

interface CardMediaProps {
  card: FeedCard;
  className: string;
  label: string;
}

export function CardMedia({ card, className, label }: CardMediaProps) {
  const [failed, setFailed] = useState(false);
  const cover = failed ? "" : coverUrl(card.cover_image);
  if (!cover) {
    return <div className={`${className} ${className}--default`} role="img" aria-label={label}><img src={assets.defaultCoverLogo} alt="" decoding="async" /><span>{label}</span></div>;
  }
  return <div className={className}><img src={cover} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></div>;
}

function statusText(lang: Language, status: EventStatus): string {
  return text(lang, `card.${status}`);
}

interface ContentCardProps {
  card: FeedCard;
  lang: Language;
  onOpenArticle?: (url: string) => void;
  status?: EventStatus;
  statusLabel?: string;
}

export function ContentCard({ card, lang, onOpenArticle, status = "reference", statusLabel }: ContentCardProps) {
  const source = safeUrl(card.url);
  const type = isOfficial(card) ? text(lang, "card.official") : isCommunity(card) ? text(lang, "card.community") : card.card_type || text(lang, "card.reference");
  const excerpt = card.bullets?.find((item) => item.trim()) ?? "";
  const canOpenInHub = Boolean(onOpenArticle && source);
  const openInHub = () => {
    if (source && onOpenArticle) onOpenArticle(source);
  };
  const isNestedAction = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("a, button"));
  const onCardClick = (event: MouseEvent<HTMLElement>) => {
    if (!canOpenInHub || isNestedAction(event.target)) return;
    openInHub();
  };
  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!canOpenInHub || isNestedAction(event.target) || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openInHub();
  };

  return <article className={`community-hub-content-item${canOpenInHub ? " is-openable" : ""}`} onClick={onCardClick} onKeyDown={onCardKeyDown} role={canOpenInHub ? "link" : undefined} tabIndex={canOpenInHub ? 0 : undefined}>
    <CardMedia card={card} className="community-hub-card-media" label={text(lang, "card.defaultCover")} />
    <div className="community-hub-card-body">
      <div className="community-hub-card-meta">
        <span>@{String(card.account || "source").replace(/^@+/, "")} · {type}</span>
        <span className={`community-hub-card-status is-${status}`}>{statusLabel ?? statusText(lang, status)} · {formatDate(card.timeline_date || card.published_at, lang)}</span>
      </div>
      <h3>{canOpenInHub ? <button type="button" className="community-hub-card-title-button" onClick={openInHub}>{card.title || "Renaiss"}</button> : card.title || "Renaiss"}</h3>
      <p className="community-hub-card-summary">{card.summary || card.glance || ""}</p>
      <div className="community-hub-card-foot">
        {excerpt ? <p>{excerpt}</p> : null}
        {canOpenInHub ? <button type="button" onClick={openInHub}>{text(lang, "action.hub")}<Icon name="arrow-right" /></button> : null}
        {source ? <a href={source} target="_blank" rel="noreferrer">{text(lang, "action.original")}<Icon name="arrow-up-right" /></a> : null}
      </div>
    </div>
  </article>;
}

interface FeatureCardProps {
  card: FeedCard;
  lang: Language;
  status: string;
}

export function FeatureCard({ card, lang, status }: FeatureCardProps) {
  const source = safeUrl(card.url);
  const content = <><CardMedia card={card} className="community-hub-feature-media" label={text(lang, "card.defaultCover")} /><div><p className="community-hub-feature-meta">{status} · {formatDate(card.timeline_date || card.published_at, lang)}</p><h3>{card.title || "Renaiss"}</h3></div></>;
  return source ? <a className="community-hub-feature-link" href={source} target="_blank" rel="noreferrer">{content}</a> : <div className="community-hub-feature-link">{content}</div>;
}
