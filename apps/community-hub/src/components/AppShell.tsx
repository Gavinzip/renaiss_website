import type { ReactNode } from "react";
import { assets } from "@/data/legacy";
import { text } from "@/lib/copy";
import type { HubView, Language } from "@/types";
import { Icon } from "./Icon";

const navItems: Array<{ icon: string; view: Exclude<HubView, "article"> }> = [
  { view: "overview", icon: "layout-dashboard" },
  { view: "events", icon: "calendar-range" },
  { view: "feed", icon: "messages-square" },
  { view: "sbt", icon: "badge-check" },
  { view: "guide", icon: "book-open-check" },
  { view: "records", icon: "trophy" },
  { view: "media", icon: "newspaper" },
  { view: "knowledge", icon: "book-open-check" },
];

interface AppShellProps {
  children: ReactNode;
  lang: Language;
  loading: boolean;
  onLanguageChange: (lang: Language) => void;
  onNavigate: (view: Exclude<HubView, "article">) => void;
  sourceState: "idle" | "live" | "error";
  status: string;
  view: HubView;
}

export function AppShell({ children, lang, loading, onLanguageChange, onNavigate, sourceState, status, view }: AppShellProps) {
  return <div className="community-hub-react-root">
    <main className="shell community-hub-shell">
      <header className="nav community-hub-topbar">
        <a className="brand" href="./" aria-label="Renaiss Community Hub"><img className="brand-logo" src={assets.renaissLogo} alt="Renaiss Logo" /><span className="brand-text">Renaiss Community Hub</span></a>
        <div className="community-hub-topbar-actions">
          <a className="community-hub-legacy-link" href="../index.html#cat-events">{text(lang, "app.legacy")}</a>
          <label className="lang-switcher" htmlFor="community-hub-lang-select"><Icon className="lang-icon" name="languages" /><select id="community-hub-lang-select" className="lang-select" value={lang} onChange={(event) => onLanguageChange(event.target.value as Language)} aria-label="Language"><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option><option value="en">English</option><option value="ko">한국어</option></select></label>
          <a className="nav-action community-hub-open" href="https://www.renaiss.xyz" target="_blank" rel="noreferrer">{text(lang, "app.open")}</a>
        </div>
      </header>
      <div className="community-hub-app">
        <aside className="community-hub-sidebar" aria-label="Community Hub sections">
          <div className="community-hub-sidebar-head"><p className="community-hub-sidebar-label">{text(lang, "app.source")}</p><span className={`community-hub-source-dot${sourceState === "live" ? " is-live" : sourceState === "error" ? " is-error" : ""}`} aria-hidden="true" /></div>
          <nav className="community-hub-nav-list">
            {navItems.map((item) => <button key={item.view} type="button" className={`community-hub-nav-item${view === item.view ? " is-active" : ""}`} onClick={() => onNavigate(item.view)} aria-current={view === item.view ? "page" : undefined}><Icon name={item.icon} /><span>{text(lang, `nav.${item.view}`)}</span></button>)}
          </nav>
          <div className="community-hub-sidebar-foot"><a href="../beginner.html?topic=start"><Icon name="book-marked" /><span>{text(lang, "app.wiki")}</span></a><a href="../agent.html"><Icon name="bot-message-square" /><span>{text(lang, "app.agent")}</span></a></div>
        </aside>
        <section className="community-hub-main" aria-live="polite">
          <div className={`community-hub-live-status${loading ? " is-loading" : sourceState === "error" ? " is-error" : ""}`} role="status">{status}</div>
          {children}
        </section>
      </div>
    </main>
  </div>;
}

interface ViewHeaderProps {
  action?: ReactNode;
  eyebrow: string;
  lead: string;
  title: string;
}

export function ViewHeader({ action, eyebrow, lead, title }: ViewHeaderProps) {
  return <header className="community-hub-page-head"><div><p className="community-hub-section-index">{eyebrow}</p><h2>{title}</h2><p>{lead}</p></div>{action}</header>;
}
