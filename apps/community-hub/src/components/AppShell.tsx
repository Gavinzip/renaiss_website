import { useEffect, useRef, type ReactNode } from "react";
import { assets } from "@/data/legacy";
import type { HubAuthState } from "@/lib/auth";
import { text } from "@/lib/copy";
import type { HubView, Language } from "@/types";
import { Icon } from "./Icon";

const navItems: Array<{ icon: string; view: Exclude<HubView, "article"> }> = [
  { view: "overview", icon: "layout-dashboard" },
  { view: "events", icon: "calendar-range" },
  { view: "official", icon: "radio" },
  { view: "feed", icon: "messages-square" },
  { view: "future", icon: "rocket" },
  { view: "sbt", icon: "badge-check" },
  { view: "profile", icon: "wallet-cards" },
  { view: "guide", icon: "book-open-check" },
  { view: "records", icon: "trophy" },
  { view: "media", icon: "newspaper" },
  { view: "knowledge", icon: "book-open-check" },
  { view: "manage", icon: "settings-2" },
];

interface AppShellProps {
  auth: HubAuthState;
  authLoading: boolean;
  children: ReactNode;
  environment: "production" | "local" | "";
  lang: Language;
  loading: boolean;
  onLanguageChange: (lang: Language) => void;
  onLogin: () => void;
  onLogout: () => void;
  onNavigate: (view: Exclude<HubView, "article">) => void;
  sourceState: "idle" | "live" | "error";
  status: string;
  view: HubView;
}

export function AppShell({ auth, authLoading, children, environment, lang, loading, onLanguageChange, onLogin, onLogout, onNavigate, sourceState, status, view }: AppShellProps) {
  const authName = auth.profile.name || auth.user;
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    const activeItem = nav?.querySelector<HTMLButtonElement>(".community-hub-nav-item.is-active");
    if (!nav || !activeItem || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      left: Math.max(0, activeItem.offsetLeft - (nav.clientWidth - activeItem.clientWidth) / 2),
    });
  }, [view]);

  return <div className="community-hub-react-root">
    <main className="shell community-hub-shell">
      <header className="nav community-hub-topbar">
        <a className="brand" href="./" aria-label="Renaiss Community Hub"><img className="brand-logo" src={assets.renaissLogo} alt="Renaiss Logo" /><span className="brand-text">Renaiss Community Hub</span></a>
        <div className="community-hub-topbar-actions">
          {environment ? <span className={`community-hub-environment is-${environment}`}><Icon name={environment === "production" ? "shield-alert" : "flask-conical"} />{environment.toUpperCase()}</span> : null}
          <a className="community-hub-legacy-link" href="../index.html#cat-events">{text(lang, "app.legacy")}</a>
          {auth.permissions.admin ? <button type="button" className="community-hub-manage-button" onClick={() => onNavigate("manage")}><Icon name="settings-2" /><span>{text(lang, "nav.manage")}</span></button> : null}
          {auth.authenticated
            ? <button type="button" className="community-hub-auth-button is-authenticated" onClick={onLogout} title={text(lang, "auth.logout")}><Icon name="circle-user-round" /><span>{authName || text(lang, "auth.account")}</span><Icon name="log-out" /></button>
            : <button type="button" className="community-hub-auth-button" onClick={onLogin} disabled={authLoading || !auth.renaiss_sso_configured}><Icon name="log-in" /><span>{authLoading ? text(lang, "auth.checking") : text(lang, "auth.login")}</span></button>}
          <label className="lang-switcher" htmlFor="community-hub-lang-select"><Icon className="lang-icon" name="languages" /><select id="community-hub-lang-select" className="lang-select" value={lang} onChange={(event) => onLanguageChange(event.target.value as Language)} aria-label="Language"><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option><option value="en">English</option><option value="ko">한국어</option></select></label>
          <a className="nav-action community-hub-open" href="https://www.renaiss.xyz" target="_blank" rel="noreferrer">{text(lang, "app.open")}</a>
        </div>
      </header>
      <div className="community-hub-app">
        <aside className="community-hub-sidebar" aria-label="Community Hub sections">
          <div className="community-hub-sidebar-head"><p className="community-hub-sidebar-label">{text(lang, "app.source")}</p><span className={`community-hub-source-dot${sourceState === "live" ? " is-live" : sourceState === "error" ? " is-error" : ""}`} aria-hidden="true" /></div>
          <nav ref={navRef} className="community-hub-nav-list">
            {navItems.filter((item) => item.view !== "manage" || auth.permissions.admin).map((item) => <button key={item.view} type="button" className={`community-hub-nav-item${view === item.view ? " is-active" : ""}`} onClick={() => onNavigate(item.view)} aria-current={view === item.view ? "page" : undefined}><Icon name={item.icon} /><span>{text(lang, `nav.${item.view}`)}</span></button>)}
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
  return <header className="community-hub-page-head"><div><p className="community-hub-section-index">{eyebrow}</p><h2>{title}</h2><p>{lead}</p></div>{action ? <div className="community-hub-page-head-actions">{action}</div> : null}</header>;
}
