import { useMemo, useState } from "react";
import "./ProductProgressView.css";
import { ViewHeader } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { AnimatedContent } from "@/components/react-bits/AnimatedContent";
import { assets } from "@/data/legacy";
import { text } from "@/lib/copy";
import { coverUrl, formatDate, safeUrl } from "@/lib/feed";
import { buildProductPortfolio, type ProductFamilyId, type ProductSnapshot, type ProductTimelineEvent } from "@/lib/productPortfolio";
import { normalizeProjectAccount, PROJECTS } from "@/lib/projects";
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

function productDisplayName(product: ProductSnapshot, lang: Language): string {
  return product.nameKey ? text(lang, product.nameKey) : product.name;
}

function productDisplaySummary(product: ProductSnapshot, lang: Language): string {
  if (!product.summaryKey) return product.summary;
  return text(lang, product.summaryKey).replace("{count}", product.timeline.length.toLocaleString(lang));
}

function ProductEvidenceMedia({ lang, onOpenArticle, product }: { lang: Language; onOpenArticle: (source: string) => void; product: ProductSnapshot }) {
  const image = coverUrl(product.evidenceImage) || assets.defaultCoverImage;
  const source = safeUrl(product.evidenceCard?.url);
  const productName = productDisplayName(product, lang);
  const content = <>
    <img src={image} alt={product.evidenceCard?.title || productName} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
    {source ? <span>{text(lang, "product.openEvidence")}<Icon name="arrow-up-right" /></span> : null}
  </>;
  return source
    ? <button type="button" className="community-hub-product-evidence-media" onClick={() => onOpenArticle(source)} aria-label={`${text(lang, "product.openEvidence")} · ${productName}`}>{content}</button>
    : <div className="community-hub-product-evidence-media">{content}</div>;
}

function ProductCard({ lang, onOpenArticle, product }: { lang: Language; onOpenArticle: (source: string) => void; product: ProductSnapshot }) {
  const productName = productDisplayName(product, lang);
  const productSummary = productDisplaySummary(product, lang);
  const visibleTimeline = product.timeline.slice(0, 4);
  const hiddenTimeline = product.timeline.slice(4);
  const modeLabel = product.mode === "experimental"
    ? text(lang, "product.mode.experimental")
      : product.mode === "candidate"
      ? text(lang, "product.mode.candidate")
      : "";
  return <article className={`community-hub-product-card is-${product.status}`}>
    <ProductEvidenceMedia lang={lang} onOpenArticle={onOpenArticle} product={product} />
    <div className="community-hub-product-card-body">
      <header>
        <span className="community-hub-product-icon"><Icon name={product.icon} /></span>
        <div>
          <p>{text(lang, `product.family.${product.familyId}`)}{modeLabel ? ` · ${modeLabel}` : ""}</p>
          <h3>{productName}</h3>
        </div>
        <span className={`community-hub-product-status is-${product.status}`}>{text(lang, `product.status.${product.status}`)}</span>
      </header>
      {productSummary ? <p className="community-hub-product-summary">{productSummary}</p> : null}
      <div className="community-hub-product-verified"><Icon name="shield-check" /><span>{text(lang, "product.lastVerified")} · {formatDate(product.lastVerifiedAt, lang)}</span></div>
      {visibleTimeline.length ? <section className="community-hub-product-timeline" aria-label={text(lang, "product.timeline")}>
        <ol>{visibleTimeline.map((event) => <ProductEventLink key={`${event.card.id}-${event.kind}`} event={event} lang={lang} onOpenArticle={onOpenArticle} />)}</ol>
        {hiddenTimeline.length ? <details>
          <summary>{text(lang, "product.showTimeline")} · {product.timeline.length}</summary>
          <ol>{hiddenTimeline.map((event) => <ProductEventLink key={`${event.card.id}-${event.kind}`} event={event} lang={lang} onOpenArticle={onOpenArticle} />)}</ol>
        </details> : null}
      </section> : <p className="community-hub-product-candidate-note">{text(lang, "product.candidateLead")}</p>}
    </div>
  </article>;
}

export function ProductProgressView({ cards, lang, loading, onOpenArticle, onRefresh, translationPending }: ProductProgressViewProps) {
  const portfolio = useMemo(() => buildProductPortfolio(cards), [cards]);
  const [sourceFilter, setSourceFilter] = useState<"all" | string>("all");
  const [familyFilter, setFamilyFilter] = useState<"all" | ProductFamilyId>("all");
  const sourceOptions = useMemo(() => {
    const projectOrder = new Map(PROJECTS.map((project, index) => [normalizeProjectAccount(project.account), index]));
    return [...portfolio.sources].sort((left, right) => {
      const leftOrder = projectOrder.get(left.account) ?? PROJECTS.length;
      const rightOrder = projectOrder.get(right.account) ?? PROJECTS.length;
      return leftOrder - rightOrder || left.account.localeCompare(right.account);
    });
  }, [portfolio.sources]);
  const sourceUpdateCount = sourceOptions.reduce((count, source) => count + source.updateCount, 0);
  const effectiveSourceFilter = sourceFilter === "all" || sourceOptions.some((source) => source.account === sourceFilter) ? sourceFilter : "all";
  const selectedSource = effectiveSourceFilter === "all" ? undefined : sourceOptions.find((source) => source.account === effectiveSourceFilter);
  const ownedProductIds = selectedSource ? new Set(selectedSource.ownedProductIds) : undefined;
  const sourceFamilies = portfolio.families.map((family) => {
    const products = ownedProductIds ? family.products.filter((product) => ownedProductIds.has(product.id)) : family.products;
    return {
      ...family,
      products,
      updateCount: products.reduce((count, product) => count + product.timeline.length, 0),
      standaloneCount: products.reduce((count, product) => count + product.standaloneCards.length, 0),
    };
  }).filter((family) => family.products.length);
  const effectiveFamilyFilter = familyFilter === "all" || sourceFamilies.some((family) => family.id === familyFilter) ? familyFilter : "all";
  const visibleFamilies = effectiveFamilyFilter === "all" ? sourceFamilies : sourceFamilies.filter((family) => family.id === effectiveFamilyFilter);
  const visibleUnmappedUpdates = effectiveSourceFilter === "all"
    ? portfolio.unmappedUpdates
    : portfolio.unmappedUpdates.filter((event) => normalizeProjectAccount(event.card.account) === effectiveSourceFilter);
  const visibleRelatedUpdates = effectiveSourceFilter === "all" ? [] : portfolio.relatedUpdates.filter((update) => {
    if (normalizeProjectAccount(update.card.account) !== effectiveSourceFilter) return false;
    if (ownedProductIds?.has(update.productId) && update.isMilestone) return false;
    return effectiveFamilyFilter === "all" || update.familyId === effectiveFamilyFilter;
  });
  const visibleUnassignedUpdates = effectiveSourceFilter === "all" || effectiveFamilyFilter !== "all"
    ? []
    : portfolio.unassignedUpdates.filter((card) => normalizeProjectAccount(card.account) === effectiveSourceFilter);
  const visibleAccountUpdates = [
    ...visibleRelatedUpdates.map((update) => ({ ...update, sourceLabelKey: "product.contextSource" })),
    ...visibleUnassignedUpdates.map((card) => ({ card, isMilestone: false, kind: "context" as const, sourceLabelKey: "product.contextStandaloneSource" })),
  ].sort((left, right) => new Date(right.card.published_at || 0).valueOf() - new Date(left.card.published_at || 0).valueOf());
  const selectSource = (account: "all" | string) => {
    setSourceFilter(account);
    setFamilyFilter("all");
  };
  const sourceProject = (account: string) => PROJECTS.find((project) => normalizeProjectAccount(project.account) === account);
  return <section className="community-hub-view is-active is-entering community-hub-product-view">
    <ViewHeader eyebrow="PRODUCT PULSE" title={text(lang, "future.title")} lead={text(lang, "future.lead")} action={<RefreshButton disabled={loading} lang={lang} onRefresh={onRefresh} />} />
    <AnimatedContent distance={16} duration={0.54}>
      <nav className="community-hub-filter-row community-hub-project-filter community-hub-project-filter-motion community-hub-product-source-filter" aria-label={text(lang, "product.accountFilter")}>
        <button type="button" className="community-hub-project-filter-button" aria-pressed={effectiveSourceFilter === "all"} onClick={() => selectSource("all")}>
          <Icon name="radio-tower" />
          <span className="community-hub-project-filter-label">{text(lang, "product.accountAll")}</span>
          <span className="community-hub-project-filter-count">{sourceUpdateCount}</span>
        </button>
        {sourceOptions.map((source) => <button type="button" key={source.account} className="community-hub-project-filter-button" aria-pressed={effectiveSourceFilter === source.account} onClick={() => selectSource(source.account)}>
          <Icon name={sourceProject(source.account)?.icon ?? "at-sign"} />
          <span className="community-hub-project-filter-label">@{sourceProject(source.account)?.account ?? source.account}</span>
          <span className="community-hub-project-filter-count">{source.updateCount}</span>
        </button>)}
      </nav>
    </AnimatedContent>
    {effectiveSourceFilter !== "all" && sourceFamilies.length > 1 ? <AnimatedContent distance={12} duration={0.46}>
      <div className="community-hub-product-family-filter-shell">
        <p>{text(lang, "product.accountProducts")}</p>
        <nav className="community-hub-filter-row community-hub-project-filter community-hub-project-filter-motion community-hub-product-family-filter" aria-label={text(lang, "product.familyFilter")}>
          <button type="button" className="community-hub-project-filter-button" aria-pressed={effectiveFamilyFilter === "all"} onClick={() => setFamilyFilter("all")}>
            <span className="community-hub-project-filter-label">{text(lang, "product.familyAll")}</span>
            <span className="community-hub-project-filter-count">{sourceFamilies.reduce((count, family) => count + family.products.length, 0)}</span>
          </button>
          {sourceFamilies.map((family) => <button type="button" key={family.id} className="community-hub-project-filter-button" aria-pressed={effectiveFamilyFilter === family.id} onClick={() => setFamilyFilter(family.id)}>
            <Icon name={family.icon} />
            <span className="community-hub-project-filter-label">{text(lang, `product.family.${family.id}`)}</span>
            <span className="community-hub-project-filter-count">{family.products.length}</span>
          </button>)}
        </nav>
      </div>
    </AnimatedContent> : null}
    {visibleFamilies.length ? <div className="community-hub-product-families">
      {visibleFamilies.map((family, familyIndex) => <AnimatedContent className="community-hub-product-family-motion" key={`${effectiveSourceFilter}-${effectiveFamilyFilter}-${family.id}`} distance={20} delay={Math.min(familyIndex * 0.035, 0.14)}>
        <section className="community-hub-product-family" aria-labelledby={`product-family-${family.id}`}>
          <header className="community-hub-product-family-head">
            <span><Icon name={family.icon} /></span>
            <div><p>{text(lang, "product.familyEyebrow")}</p><h2 id={`product-family-${family.id}`}>{text(lang, `product.family.${family.id}`)}</h2></div>
            <small>{family.products.length} {text(lang, "product.products")} · {family.updateCount} {text(lang, "product.updates")}</small>
          </header>
          <div className="community-hub-product-grid">{family.products.map((product, productIndex) => <AnimatedContent className="community-hub-product-card-motion" key={product.id} distance={14} delay={Math.min(productIndex * 0.045, 0.12)} duration={0.56}>
            <ProductCard lang={lang} onOpenArticle={onOpenArticle} product={product} />
          </AnimatedContent>)}</div>
        </section>
      </AnimatedContent>)}
    </div> : effectiveFamilyFilter === "all" && visibleUnmappedUpdates.length ? null : <EmptyState title={text(lang, translationPending ? "empty.translating" : effectiveSourceFilter === "all" ? "product.noProducts" : "product.noOwnedProducts")} />}
    {visibleAccountUpdates.length ? <AnimatedContent distance={16} duration={0.52}>
      <section className="community-hub-product-context" aria-labelledby="product-context-title">
        <header className="community-hub-product-context-head">
          <div>
            <p>{text(lang, "product.contextEyebrow")}</p>
            <h2 id="product-context-title">{text(lang, "product.contextTitle")}</h2>
          </div>
          <small>{visibleAccountUpdates.length} {text(lang, "product.contextCount")}</small>
        </header>
        <p className="community-hub-product-context-lead">{text(lang, "product.contextLead")}</p>
        <div className="community-hub-content-list community-hub-product-context-list">
          {visibleAccountUpdates.map(({ card, isMilestone, kind, sourceLabelKey }) => <ContentCard
            key={card.id || card.url || `${card.title}-${card.published_at}`}
            card={card}
            lang={lang}
            onOpenArticle={onOpenArticle}
            sourceLabel={text(lang, sourceLabelKey)}
            statusLabel={text(lang, isMilestone ? `product.update.${kind}` : "product.contextStatus")}
          />)}
        </div>
      </section>
    </AnimatedContent> : null}
    {effectiveFamilyFilter === "all" && visibleUnmappedUpdates.length ? <section className="community-hub-product-unmapped" aria-labelledby="product-unmapped-title">
      <header><Icon name="scan-search" /><div><h2 id="product-unmapped-title">{text(lang, "product.unmappedTitle")}</h2><p>{text(lang, "product.unmappedLead")}</p></div></header>
      <ol>{visibleUnmappedUpdates.map((event) => <ProductEventLink key={`${event.card.id}-${event.kind}`} event={event} lang={lang} onOpenArticle={onOpenArticle} />)}</ol>
    </section> : null}
  </section>;
}
