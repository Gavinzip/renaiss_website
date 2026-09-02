import { useMemo, useState } from "react";
import "./ProductProgressView.css";
import { ViewHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { text } from "@/lib/copy";
import { formatDate, safeUrl } from "@/lib/feed";
import { buildProductPortfolio, type ProductFamilyId, type ProductSnapshot, type ProductTimelineEvent } from "@/lib/productPortfolio";
import type { FeedCard, Language } from "@/types";

interface ProductProgressViewProps {
  cards: FeedCard[];
  lang: Language;
  loading: boolean;
  onOpenArticle: (source: string) => void;
  onRefresh: () => void;
  translationPending: boolean;
}

function RefreshButton({ disabled, lang, onRefresh }: { disabled: boolean; lang: Language; onRefresh: () => void }) {
  return <button type="button" className="community-hub-refresh" disabled={disabled} onClick={onRefresh}><Icon name="refresh-cw" /><span>{text(lang, "action.refresh")}</span></button>;
}

function ProductEventLink({ event, lang, onOpenArticle }: { event: ProductTimelineEvent; lang: Language; onOpenArticle: (source: string) => void }) {
  const source = safeUrl(event.card.url);
  return <li className="community-hub-product-event">
    <span className="community-hub-product-event-dot" aria-hidden="true" />
    <time dateTime={event.date}>{formatDate(event.date || event.card.published_at, lang)}</time>
    <div>
      <span>{text(lang, `product.update.${event.kind}`)}</span>
      {source ? <button type="button" onClick={() => onOpenArticle(source)}>{event.card.title || "Renaiss"}</button> : <strong>{event.card.title || "Renaiss"}</strong>}
    </div>
  </li>;
}

function RelatedCardLink({ card, lang, onOpenArticle }: { card: FeedCard; lang: Language; onOpenArticle: (source: string) => void }) {
  const source = safeUrl(card.url);
  return <li>
    <time dateTime={String(card.published_at ?? "")}>{formatDate(card.published_at, lang)}</time>
    {source ? <button type="button" onClick={() => onOpenArticle(source)}>{card.title || "Renaiss"}</button> : <span>{card.title || "Renaiss"}</span>}
  </li>;
}

function ProductCard({ lang, onOpenArticle, product }: { lang: Language; onOpenArticle: (source: string) => void; product: ProductSnapshot }) {
  const visibleTimeline = product.timeline.slice(0, 3);
  const hiddenTimeline = product.timeline.slice(3);
  const related = product.relatedCards.slice(0, 5);
  const modeLabel = product.mode === "experimental"
    ? text(lang, "product.mode.experimental")
    : product.mode === "candidate"
      ? text(lang, "product.mode.candidate")
      : "";
  return <article className={`community-hub-product-card is-${product.status}`}>
    <header>
      <span className="community-hub-product-icon"><Icon name={product.icon} /></span>
      <div>
        <p>{text(lang, `product.family.${product.familyId}`)}{modeLabel ? ` · ${modeLabel}` : ""}</p>
        <h3>{product.name}</h3>
      </div>
      <span className={`community-hub-product-status is-${product.status}`}>{text(lang, `product.status.${product.status}`)}</span>
    </header>
    {product.summary ? <p className="community-hub-product-summary">{product.summary}</p> : null}
    <div className="community-hub-product-verified"><Icon name="shield-check" /><span>{text(lang, "product.lastVerified")} · {formatDate(product.lastVerifiedAt, lang)}</span></div>
    {visibleTimeline.length ? <section className="community-hub-product-timeline" aria-label={text(lang, "product.timeline")}>
      <ol>{visibleTimeline.map((event) => <ProductEventLink key={`${event.card.id}-${event.kind}`} event={event} lang={lang} onOpenArticle={onOpenArticle} />)}</ol>
      {hiddenTimeline.length ? <details>
        <summary>{text(lang, "product.showTimeline")} · {product.timeline.length}</summary>
        <ol>{hiddenTimeline.map((event) => <ProductEventLink key={`${event.card.id}-${event.kind}`} event={event} lang={lang} onOpenArticle={onOpenArticle} />)}</ol>
      </details> : null}
    </section> : <p className="community-hub-product-candidate-note">{text(lang, "product.candidateLead")}</p>}
    {related.length ? <details className="community-hub-product-related">
      <summary>{text(lang, "product.related")} · {product.relatedCards.length}</summary>
      <p>{text(lang, "product.relatedLead")}</p>
      <ul>{related.map((card) => <RelatedCardLink key={card.id || card.url} card={card} lang={lang} onOpenArticle={onOpenArticle} />)}</ul>
    </details> : null}
  </article>;
}

export function ProductProgressView({ cards, lang, loading, onOpenArticle, onRefresh, translationPending }: ProductProgressViewProps) {
  const portfolio = useMemo(() => buildProductPortfolio(cards), [cards]);
  const [familyFilter, setFamilyFilter] = useState<"all" | ProductFamilyId>("all");
  const visibleFamilies = familyFilter === "all" ? portfolio.families : portfolio.families.filter((family) => family.id === familyFilter);
  return <section className="community-hub-view is-active is-entering community-hub-product-view">
    <ViewHeader eyebrow="PRODUCT PULSE" title={text(lang, "future.title")} lead={text(lang, "future.lead")} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <div className="community-hub-product-summary-strip" aria-label={text(lang, "product.summaryLabel")}>
      <div><Icon name="boxes" /><span>{text(lang, "product.productsLabel")}</span><strong>{portfolio.productCount}</strong></div>
      <div><Icon name="git-commit-horizontal" /><span>{text(lang, "product.updatesLabel")}</span><strong>{portfolio.updateCount}</strong></div>
      <div><Icon name="layers-3" /><span>{text(lang, "product.familiesLabel")}</span><strong>{portfolio.families.length}</strong></div>
    </div>
    <p className="community-hub-product-method"><Icon name="badge-check" />{text(lang, "product.method")}</p>
    <nav className="community-hub-product-family-filter" aria-label={text(lang, "product.familyFilter")}>
      <button type="button" className={familyFilter === "all" ? "is-active" : ""} onClick={() => setFamilyFilter("all")}><Icon name="layout-grid" /><span>{text(lang, "filter.all")}</span><small>{portfolio.productCount}</small></button>
      {portfolio.families.map((family) => <button type="button" key={family.id} className={familyFilter === family.id ? "is-active" : ""} onClick={() => setFamilyFilter(family.id)}><Icon name={family.icon} /><span>{text(lang, `product.family.${family.id}`)}</span><small>{family.products.length}</small></button>)}
    </nav>
    {visibleFamilies.length ? <div className="community-hub-product-families">
      {visibleFamilies.map((family) => <section className="community-hub-product-family" key={family.id} aria-labelledby={`product-family-${family.id}`}>
        <header className="community-hub-product-family-head">
          <span><Icon name={family.icon} /></span>
          <div><p>{text(lang, "product.familyEyebrow")}</p><h2 id={`product-family-${family.id}`}>{text(lang, `product.family.${family.id}`)}</h2></div>
          <small>{family.products.length} {text(lang, "product.products")} · {family.updateCount} {text(lang, "product.updates")}</small>
        </header>
        <div className="community-hub-product-grid">{family.products.map((product) => <ProductCard key={product.id} lang={lang} onOpenArticle={onOpenArticle} product={product} />)}</div>
      </section>)}
    </div> : familyFilter === "all" && portfolio.unmappedUpdates.length ? null : <EmptyState title={text(lang, translationPending ? "empty.translating" : "product.noProducts")} />}
    {familyFilter === "all" && portfolio.unmappedUpdates.length ? <section className="community-hub-product-unmapped" aria-labelledby="product-unmapped-title">
      <header><Icon name="scan-search" /><div><h2 id="product-unmapped-title">{text(lang, "product.unmappedTitle")}</h2><p>{text(lang, "product.unmappedLead")}</p></div></header>
      <ol>{portfolio.unmappedUpdates.map((event) => <ProductEventLink key={`${event.card.id}-${event.kind}`} event={event} lang={lang} onOpenArticle={onOpenArticle} />)}</ol>
    </section> : null}
  </section>;
}
