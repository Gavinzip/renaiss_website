import { useEffect, useMemo, useState } from "react";
import { ViewHeader } from "@/components/AppShell";
import { ContentCard } from "@/components/ContentCard";
import { Icon } from "@/components/Icon";
import { readAdminStatus, readEditorialHistory, triggerIntelSync, updateTrackedAccount, type AdminStatus, type EditorialHistoryItem } from "@/lib/admin";
import { formatUpdate } from "@/lib/feed";
import { PROJECTS, projectIdForAccount, projectLabel, type ProjectId } from "@/lib/projects";
import type { FeedCard, Language } from "@/types";

type AdminSection = "status" | "review" | "sources" | "history";
type AccountCategory = "official" | "official_community" | "ambassador";

const ACCOUNT_CATEGORY_LABELS: Record<AccountCategory, string> = {
  official: "官方",
  official_community: "官方社區",
  ambassador: "大使",
};

const OFFICIAL_COMMUNITY_ACCOUNTS = new Set(["renaisskrcm", "renaissmycm", "renaisstwcm", "renaiss_vn", "renaiss_th"]);

function needsReview(card: FeedCard): boolean {
  const review = String(card.review_status ?? "").toLowerCase();
  const ai = String(card.ai_status ?? "").toLowerCase();
  return review.includes("queue") || ["pending", "needs_review", "failed"].includes(ai);
}

function statusText(value: unknown): string {
  const raw = String(value ?? "idle").toLowerCase();
  return ({ idle: "待命", running: "處理中", queued: "排隊中", ok: "完成", failed: "失敗" } as Record<string, string>)[raw] ?? raw;
}

function StatusMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return <article className="community-hub-admin-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function useAdminStatus() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [error, setError] = useState("");
  const load = async () => {
    setError("");
    try { setStatus(await readAdminStatus()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "無法讀取管理狀態"); }
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return { error, load, status };
}

function StatusSection({ cards, onRefresh }: { cards: FeedCard[]; onRefresh: () => void }) {
  const { error, load, status } = useAdminStatus();
  const [syncing, setSyncing] = useState(false);
  const queue = cards.filter(needsReview).length;
  const manual = cards.filter((card) => String(card.classified_by ?? "") === "manual").length;
  const sync = status?.sync;
  const done = Number(sync?.progress_done_cards ?? 0);
  const total = Number(sync?.progress_total_cards ?? 0);
  const i18nRows = status?.i18n?.lang_progress ?? {};
  const jobItems = [...(status?.content_refresh?.items ?? []), ...(status?.jobs?.items ?? [])].slice(0, 8);
  const runSync = async () => {
    if (!window.confirm("立即掃描最近 30 天的追蹤來源？人工覆寫會保留。")) return;
    setSyncing(true);
    try { await triggerIntelSync(); await load(); onRefresh(); }
    finally { setSyncing(false); }
  };
  return <div className="community-hub-admin-section">
    <div className="community-hub-admin-section-head"><div><h3>系統與整理進度</h3><p>管理員操作直接在各內容卡片完成；這裡顯示同步、翻譯與人工確認狀態。</p></div><div><button type="button" onClick={() => void load()}><Icon name="refresh-cw" />更新狀態</button><button type="button" onClick={runSync} disabled={syncing}><Icon name="scan-search" />{syncing ? "啟動中" : "立即掃描"}</button></div></div>
    {error ? <p className="community-hub-admin-error" role="alert">{error}</p> : null}
    <div className="community-hub-admin-metrics">
      <StatusMetric label="同步" value={statusText(sync?.status)} detail={total ? `${done}/${total} 篇 · ${sync?.stage_label || "等待下一階段"}` : `上次完成 ${formatUpdate(sync?.last_success_at, "zh-Hant")}`} />
      <StatusMetric label="待人工確認" value={String(queue)} detail={`這些內容不會出現在公開頁面 · 人工分類 ${manual} 篇`} />
      <StatusMetric label="新貼文" value={`${Number(status?.new_posts?.new_cards_24h ?? 0)} / 24h`} detail={`6h ${Number(status?.new_posts?.new_cards_6h ?? 0)} · 待處理 ${Number(status?.new_posts?.pending_processing ?? 0)}`} />
      <StatusMetric label="人工覆寫" value={String(Number(status?.memory?.field_overrides ?? 0))} detail={`回饋 ${Number(status?.memory?.feedback_items ?? 0)} · 規則 ${Number(status?.memory?.rules ?? 0)}`} />
    </div>
    <section className="community-hub-admin-progress"><h4>四語言翻譯</h4>{["zh-Hant", "zh-Hans", "en", "ko"].map((tag) => { const row = i18nRows[tag] ?? {}; const doneCount = Number(row.done ?? 0); const totalCount = Number(row.total ?? 0); const ratio = totalCount ? Math.min(100, Math.round(doneCount / totalCount * 100)) : 0; return <div key={tag}><span>{tag}</span><div><i style={{ width: `${ratio}%` }} /></div><strong>{doneCount}/{totalCount || "--"}</strong></div>; })}</section>
    <section className="community-hub-admin-jobs"><h4>近期背景工作</h4>{jobItems.length ? <ul>{jobItems.map((job, index) => <li key={String(job.id ?? index)}><strong>{String(job.status ?? "--").toUpperCase()}</strong><span>{String(job.title ?? job.message ?? job.url ?? "背景整理")}</span><time>{formatUpdate(job.updated_at ?? job.created_at, "zh-Hant")}</time></li>)}</ul> : <p>目前沒有背景工作。</p>}</section>
  </div>;
}

function ReviewSection({ cards }: { cards: FeedCard[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => cards.filter(needsReview).filter((card) => [card.title, card.summary, card.account].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [cards, query]);
  return <div className="community-hub-admin-section">
    <div className="community-hub-admin-section-head"><div><h3>待人工確認佇列</h3><p>尚未確認的內容只在這裡出現，不會先送到公開頁面。直接展開卡片下方工具即可重新分類、改日期或隱藏。</p></div><strong>{rows.length} 篇</strong></div>
    <div className="community-hub-admin-toolbar"><label><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋待確認內容" /></label><span>{rows.length} 篇</span></div>
    <div className="community-hub-content-list">{rows.map((card) => <ContentCard key={card.id || card.url} card={card} lang="zh-Hant" sourceLabel="待人工確認" />)}</div>
    {!rows.length ? <p className="community-hub-admin-empty">目前沒有待人工確認的文章。</p> : null}
  </div>;
}

function SourcesSection() {
  const { error, load, status } = useAdminStatus();
  const [account, setAccount] = useState("");
  const [newCategory, setNewCategory] = useState<AccountCategory>("ambassador");
  const [newProject, setNewProject] = useState<ProjectId>("tcg");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const monitor = status?.monitors?.x;
  const accounts = monitor?.accounts ?? [];
  const categories = monitor?.account_categories ?? {};
  const accountProjects = monitor?.account_projects ?? {};
  const accountCategory = (value: string): AccountCategory => {
    const normalized = value.toLowerCase();
    return categories[value]
      ?? categories[normalized]
      ?? (normalized === "renaissxyz" ? "official" : OFFICIAL_COMMUNITY_ACCOUNTS.has(normalized) ? "official_community" : "ambassador");
  };
  const groupedAccounts = useMemo(() => ({
    official: accounts.filter((value) => accountCategory(value) === "official"),
    official_community: accounts.filter((value) => accountCategory(value) === "official_community"),
    ambassador: accounts.filter((value) => accountCategory(value) === "ambassador"),
  }), [accounts, categories]);
  const mutate = async (action: "add" | "remove" | "set_category" | "set_project", value: string, category?: AccountCategory, projectId?: ProjectId) => {
    setBusy(`${action}:${value}`);
    setMessage("");
    try {
      await updateTrackedAccount(action, value, category, projectId);
      setAccount("");
      setMessage(action === "add" ? "已加入追蹤帳號；下次掃描會開始收錄。" : action === "remove" ? "已停止追蹤；既有內容不會立即刪除。" : action === "set_project" && projectId ? `已將 @${value.replace(/^@+/, "")} 分到「${projectLabel(projectId, "zh-Hant")}」。` : `已將 @${value.replace(/^@+/, "")} 分到${category ? ACCOUNT_CATEGORY_LABELS[category] : "指定分類"}。`);
      await load();
    }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "更新失敗"); }
    finally { setBusy(""); }
  };
  const renderGroup = (category: AccountCategory, label: string) => {
    const rows = groupedAccounts[category];
    return <section className="community-hub-admin-source-group" key={category}>
      <header><span>{label}</span><small>{rows.length} 個帳號</small></header>
      <div className="community-hub-admin-source-list">{rows.map((value) => {
        const handle = value.replace(/^@+/, "");
        const projectId = projectIdForAccount(value, accountProjects);
        return <article key={value}>
          <a href={`https://x.com/${encodeURIComponent(handle)}`} target="_blank" rel="noreferrer" title={`在 X 開啟 @${handle}`}>
            <span><strong>@{handle}</strong><small>{String(monitor?.source_quality?.[value] ?? "等待來源狀態")}</small></span>
            <Icon name="external-link" />
          </a>
          <label className="community-hub-admin-source-category"><select aria-label={`@${handle} 分類`} value={category} onChange={(event) => { const nextCategory = event.target.value as AccountCategory; void mutate("set_category", value, nextCategory, nextCategory === "official" ? projectId || "tcg" : undefined); }} disabled={Boolean(busy)}>{Object.entries(ACCOUNT_CATEGORY_LABELS).map(([option, optionLabel]) => <option key={option} value={option}>{optionLabel}</option>)}</select></label>
          {category === "official" ? <label className="community-hub-admin-source-category"><select aria-label={`@${handle} 官方動態分類`} value={projectId || "tcg"} onChange={(event) => void mutate("set_project", value, "official", event.target.value as ProjectId)} disabled={Boolean(busy)}>{PROJECTS.map((project) => <option key={project.id} value={project.id}>{projectLabel(project.id, "zh-Hant")}</option>)}</select></label> : null}
          <button type="button" onClick={() => void mutate("remove", value)} disabled={Boolean(busy)} title={`停止追蹤 @${handle}`}><Icon name="trash-2" /><span>移除</span></button>
        </article>;
      })}</div>
    </section>;
  };
  return <div className="community-hub-admin-section">
    <div className="community-hub-admin-section-head"><div><h3>目前追蹤的帳號</h3><p>點帳號可直接開啟 X；官方帳號的動態分類會同步成為公開頁面的分流依據。</p></div><span>{accounts.length} 個帳號</span></div>
    {error ? <p className="community-hub-admin-error">{error}</p> : null}
    <form className="community-hub-admin-source-form" onSubmit={(event) => { event.preventDefault(); void mutate("add", account, newCategory, newCategory === "official" ? newProject : undefined); }}><label><span>@</span><input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="輸入 X 帳號" /></label><select aria-label="新帳號身分分類" value={newCategory} onChange={(event) => setNewCategory(event.target.value as AccountCategory)}>{Object.entries(ACCOUNT_CATEGORY_LABELS).map(([option, optionLabel]) => <option key={option} value={option}>{optionLabel}</option>)}</select>{newCategory === "official" ? <select aria-label="新官方帳號動態分類" value={newProject} onChange={(event) => setNewProject(event.target.value as ProjectId)}>{PROJECTS.map((project) => <option key={project.id} value={project.id}>{projectLabel(project.id, "zh-Hant")}</option>)}</select> : null}<button type="submit" disabled={!account.trim() || Boolean(busy)}><Icon name="plus" />加入追蹤</button></form>
    <div className="community-hub-admin-source-groups">{renderGroup("official", "官方")}{renderGroup("official_community", "官方社區")}{renderGroup("ambassador", "大使")}</div>
    <p className="community-hub-admin-source-message" role="status">{message}</p>
  </div>;
}

function HistorySection() {
  const [items, setItems] = useState<EditorialHistoryItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void readEditorialHistory().then(setItems).catch((reason) => setError(reason instanceof Error ? reason.message : "無法讀取紀錄")); }, []);
  return <div className="community-hub-admin-section"><div className="community-hub-admin-section-head"><div><h3>人工變更紀錄</h3><p>每次從卡片修改分類、日期、地區、進度或 SBT 都會留下版本與操作者。</p></div><span>{items.length} 筆</span></div>{error ? <p className="community-hub-admin-error">{error}</p> : null}<ol className="community-hub-admin-history">{items.map((item, index) => <li key={`${item.id}-${item.revision}-${index}`}><span>v{item.revision ?? "-"}</span><div><strong>{item.source_title || item.id}</strong><small>@{String(item.source_account || "source").replace(/^@+/, "")} · {item.actor || "admin"}</small><code>{Object.keys(item.patch ?? {}).join(" · ") || "欄位更新"}</code></div><time>{formatUpdate(item.updated_at, "zh-Hant")}</time></li>)}</ol></div>;
}

export function AdminView({ cards, lang, onRefresh, sourceError }: { cards: FeedCard[]; lang: Language; onRefresh: () => void; sourceError?: string }) {
  const [section, setSection] = useState<AdminSection>("status");
  const tabs: Array<[AdminSection, string, string]> = [["status", "activity", "系統狀態"], ["review", "list-checks", "待確認"], ["sources", "rss", "追蹤帳號"], ["history", "history", "變更紀錄"]];
  return <section className="community-hub-view is-active is-entering community-hub-admin-view">
    <ViewHeader eyebrow="CREATOR CONTROL" title="內容管理中心" lead="集中查看系統、待確認佇列、追蹤來源與操作紀錄；貼文和 SBT 的實際修改回到各自卡片上完成。" />
    {sourceError ? <p className="community-hub-admin-error" role="alert">管理內容讀取失敗：{sourceError}</p> : null}
    <nav className="community-hub-admin-tabs" aria-label="管理中心分區">{tabs.map(([value, icon, label]) => <button type="button" key={value} className={section === value ? "is-active" : ""} onClick={() => setSection(value)}><Icon name={icon} />{label}</button>)}</nav>
    {section === "status" ? <StatusSection cards={cards} onRefresh={onRefresh} /> : null}
    {section === "review" ? <ReviewSection cards={cards} /> : null}
    {section === "sources" ? <SourcesSection /> : null}
    {section === "history" ? <HistorySection /> : null}
    <span className="community-hub-admin-language-note">目前介面語言：{lang}</span>
  </section>;
}
