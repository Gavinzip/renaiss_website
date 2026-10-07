import { Icon } from "@/components/Icon";
import { FeatureCard } from "@/components/ContentCard";
import { eventStatus, formatDate } from "@/lib/feed";
import { recentHighlights } from "@/lib/highlights";
import { sbtAcquisitionSignals } from "@/lib/sbt";
import { text } from "@/lib/copy";
import type { AccountProjectMap } from "@/lib/projects";
import type { FeedCard, HubView, Language } from "@/types";

interface OverviewViewProps {
  accountProjects: AccountProjectMap;
  cards: FeedCard[];
  lang: Language;
  onNavigate: (view: Exclude<HubView, "article">) => void;
}

export function OverviewView({ accountProjects, cards, lang, onNavigate }: OverviewViewProps) {
  const highlights = recentHighlights(cards, accountProjects);
  const limitedSbt = sbtAcquisitionSignals(cards, accountProjects).slice(0, 4);
  const routes: Array<{ icon: string; label: string; sub: string; view: Exclude<HubView, "article"> }> = [
    { icon: "radio", view: "official", label: text(lang, "overview.route.official"), sub: text(lang, "overview.route.officialSub") },
    { icon: "messages-square", view: "feed", label: text(lang, "overview.route.feed"), sub: text(lang, "overview.route.feedSub") },
    { icon: "calendar-range", view: "events", label: text(lang, "overview.route.events"), sub: text(lang, "overview.route.eventsSub") },
    { icon: "rocket", view: "future", label: text(lang, "overview.route.future"), sub: text(lang, "overview.route.futureSub") },
    { icon: "badge-check", view: "sbt", label: text(lang, "overview.route.sbt"), sub: text(lang, "overview.route.sbtSub") },
    { icon: "trophy", view: "records", label: text(lang, "overview.route.records"), sub: text(lang, "overview.route.recordsSub") },
    { icon: "book-open-check", view: "guide", label: text(lang, "overview.route.guide"), sub: text(lang, "overview.route.guideSub") },
  ];

  return <section className="community-hub-view is-active is-entering">
    <header className="community-hub-intro">
      <div>
        <h1>Renaiss <span className="text-gradient">Community Hub</span></h1>
        <p className="community-hub-intro-lead">{text(lang, "overview.lead")}</p>
        <div className="community-hub-intro-actions">
          <button type="button" className="btn btn-main" onClick={() => onNavigate("events")}><span className="shine" /><Icon name="radar" /><span>{text(lang, "overview.events")}</span></button>
          <button type="button" className="btn btn-sub" onClick={() => onNavigate("feed")}><Icon name="messages-square" /><span>{text(lang, "overview.feed")}</span></button>
        </div>
      </div>
      <div className="community-hub-briefing"><span>{text(lang, "overview.source")}</span><strong>Renaiss Intel</strong><small>{cards.length ? `${cards.length} ${text(lang, "status.cards")}` : "--"}</small></div>
    </header>

    {highlights.cards.length ? <section className="community-hub-overview-section">
      <div className="community-hub-section-head"><div><p className="community-hub-section-index">01</p><h2>{text(lang, "overview.happening")}</h2></div><button type="button" className="community-hub-text-button" onClick={() => onNavigate(highlights.view)}>{text(lang, highlights.view === "events" ? "overview.allEvents" : "overview.allOfficial")}</button></div>
      <div className="community-hub-feature-rail">{highlights.cards.map((card) => <FeatureCard key={card.url ?? card.title} card={card} date={highlights.view === "events" ? card.effective_event_date : card.published_at} lang={lang} status={text(lang, highlights.view === "events" ? `card.${eventStatus(card)}` : "card.official")} />)}</div>
    </section> : null}

    <section className="community-hub-overview-section">
      <div className="community-hub-section-head"><div><p className="community-hub-section-index">02</p><h2>{text(lang, "overview.limitedSbt")}</h2></div><button type="button" className="community-hub-text-button" onClick={() => onNavigate("sbt")}>{text(lang, "overview.allSbt")}</button></div>
      <div className="community-hub-overview-sbt-list">
        {limitedSbt.length ? limitedSbt.map((campaign) => <a key={`${campaign.source}-${campaign.name}`} className="community-hub-overview-sbt-link" href={campaign.source} target="_blank" rel="noreferrer"><span className="community-hub-overview-sbt-icon"><Icon name="badge-check" /></span><span className="community-hub-overview-sbt-copy"><small>{text(lang, `sbt.status.${campaign.status}`)} · {formatDate(campaign.startDate, lang)} – {formatDate(campaign.date, lang)}</small><strong>{campaign.name}</strong><em>{campaign.acquisition}</em></span><Icon className="community-hub-overview-sbt-arrow" name="arrow-up-right" /></a>) : <div className="community-hub-empty"><strong>{text(lang, "overview.limitedEmpty")}</strong></div>}
      </div>
    </section>

    <section className="community-hub-overview-section community-hub-overview-routes">
      <div className="community-hub-section-head"><div><p className="community-hub-section-index">03</p><h2>{text(lang, "overview.start")}</h2></div></div>
      <nav className="community-hub-route-list" aria-label="Community Hub quick index">{routes.map((route, index) => <button key={route.view} type="button" onClick={() => onNavigate(route.view)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{route.label}</strong><small>{route.sub}</small><Icon name={route.icon} /></button>)}</nav>
    </section>
  </section>;
}
