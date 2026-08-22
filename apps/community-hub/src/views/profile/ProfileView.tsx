import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ViewHeader } from "@/components/AppShell";
import { fetchTcgProfile, normalizeProfileWallet, TCG_PROFILE_POSTER_KINDS, TCG_PROFILE_REQUEST_TIMEOUT_MS, type TcgProfileData } from "@/lib/profile";
import type { Language } from "@/types";
import { ProfilePoster, profilePosterLabel, type ProfilePosterKind } from "./ProfilePosters";
import "./profile.css";

interface ProfileViewProps {
  lang: Language;
}

const COPY: Record<Language, Record<string, string>> = {
  "zh-Hant": { title: "鏈上 Profile", lead: "先選擇海報，再輸入 BNB Chain 錢包；每次只查這張 TCG Pro 海報需要的資料。", label: "錢包地址", placeholder: "0x...", submit: "查詢這張海報", loading: "正在查詢", invalid: "請輸入有效的 0x 錢包地址。", done: "海報已完成", live: "即時鏈上資料", cached: "API 快取", local: "已載入", warning: "資料來源提醒" },
  "zh-Hans": { title: "链上 Profile", lead: "先选择海报，再输入 BNB Chain 钱包；每次只查询这张 TCG Pro 海报需要的资料。", label: "钱包地址", placeholder: "0x...", submit: "查询这张海报", loading: "正在查询", invalid: "请输入有效的 0x 钱包地址。", done: "海报已完成", live: "即时链上资料", cached: "API 缓存", local: "已载入", warning: "资料来源提醒" },
  en: { title: "On-chain Profile", lead: "Choose a poster, then enter a BNB Chain wallet. Each request loads only what that TCG Pro poster needs.", label: "Wallet address", placeholder: "0x...", submit: "Load this poster", loading: "Loading", invalid: "Enter a valid 0x wallet address.", done: "Poster ready", live: "Live on-chain data", cached: "API cache", local: "Already loaded", warning: "Source notice" },
  ko: { title: "온체인 Profile", lead: "포스터를 먼저 선택한 뒤 BNB Chain 지갑을 입력하세요. 요청마다 해당 TCG Pro 포스터에 필요한 데이터만 조회합니다.", label: "지갑 주소", placeholder: "0x...", submit: "이 포스터 조회", loading: "조회 중", invalid: "유효한 0x 지갑 주소를 입력하세요.", done: "포스터 준비 완료", live: "실시간 온체인 데이터", cached: "API 캐시", local: "불러옴", warning: "데이터 소스 안내" },
};

function warningText(code: string | undefined, message: string | undefined, lang: Language): string {
  if (code === "activity_hints_unavailable") {
    if (lang === "zh-Hant") return "官方活動提示目前未授權；包名使用鏈上合約與本機映射，主要盈虧仍來自鏈上。";
    if (lang === "zh-Hans") return "官方活动提示目前未授权；包名使用链上合约与本机映射，主要盈亏仍来自链上。";
    if (lang === "ko") return "공식 활동 힌트가 현재 인증되지 않아 팩 이름은 온체인 계약과 로컬 매핑을 사용합니다. 주요 손익은 계속 온체인 데이터입니다.";
  }
  if (code === "ranking_wallet_unavailable") {
    if (lang === "zh-Hant") return "目前的 TCG Pro 排行快照沒有這個錢包，因此海報保留排行位置並顯示「—」，不會猜測名次。";
    if (lang === "zh-Hans") return "目前的 TCG Pro 排行快照没有这个钱包，因此海报保留排行位置并显示「—」，不会猜测名次。";
    if (lang === "ko") return "현재 TCG Pro 랭킹 스냅샷에 이 지갑이 없어 랭킹 위치는 유지하되 순위를 추정하지 않고 '—'로 표시합니다.";
    return "This wallet is absent from the current TCG Pro ranking snapshot, so poster rank slots show '—' instead of an estimate.";
  }
  return message || code || "Profile data warning";
}

function requestErrorText(error: Error, lang: Language): string {
  if (error.message === "invalid_wallet") return COPY[lang].invalid;
  if (error.message === "profile_lookup_failed") {
    if (lang === "zh-Hant") return "Profile 資料來源目前無法完成查詢，請稍後重試。";
    if (lang === "zh-Hans") return "Profile 资料来源目前无法完成查询，请稍后重试。";
    if (lang === "ko") return "Profile 데이터 조회를 완료할 수 없습니다. 잠시 후 다시 시도하세요.";
    return "The Profile data source could not complete this lookup. Please try again shortly.";
  }
  if (error.message === "profile lookup capacity reached; retry shortly" || error.message === "HTTP 429") {
    if (lang === "zh-Hant") return "Profile 查詢佇列目前已滿，請等待 5 至 10 秒後再試。";
    if (lang === "zh-Hans") return "Profile 查询队列目前已满，请等待 5 至 10 秒后重试。";
    if (lang === "ko") return "Profile 조회 대기열이 가득 찼습니다. 5~10초 후 다시 시도하세요.";
    return "The Profile queue is full. Please try again in 5 to 10 seconds.";
  }
  if (error.message === "unauthorized" || error.message === "HTTP 401") {
    if (lang === "zh-Hant") return "Profile API 驗證設定錯誤，請通知網站管理員。";
    if (lang === "zh-Hans") return "Profile API 验证设置错误，请通知网站管理员。";
    if (lang === "ko") return "Profile API 인증 설정에 문제가 있습니다. 사이트 관리자에게 알려 주세요.";
    return "The Profile API authentication is misconfigured. Please notify the site administrator.";
  }
  if (error.message === "TCG Profile API is not configured" || error.message === "HTTP 503") {
    if (lang === "zh-Hant") return "網站後端尚未設定 Profile API，請通知網站管理員。";
    if (lang === "zh-Hans") return "网站后端尚未设置 Profile API，请通知网站管理员。";
    if (lang === "ko") return "웹사이트 백엔드에 Profile API가 아직 설정되지 않았습니다. 사이트 관리자에게 알려 주세요.";
    return "The website backend has not been configured for the Profile API. Please notify the site administrator.";
  }
  if (error.message === "TCG Profile API timeout" || error.message === "HTTP 504" || error.message === "Profile lookup timeout") {
    if (lang === "zh-Hant") return "Profile 查詢等待逾時，請稍後再試。";
    if (lang === "zh-Hans") return "Profile 查询等待超时，请稍后重试。";
    if (lang === "ko") return "Profile 조회 대기 시간이 초과되었습니다. 잠시 후 다시 시도하세요.";
    return "The Profile lookup timed out. Please try again shortly.";
  }
  if (error.message === "ranking_snapshot_unavailable") {
    if (lang === "zh-Hant") return "TCG Pro 排行快照尚未載入，無法顯示盈虧與排名海報。";
    if (lang === "zh-Hans") return "TCG Pro 排行快照尚未载入，无法显示盈亏与排名海报。";
    if (lang === "ko") return "TCG Pro 랭킹 스냅샷이 아직 준비되지 않아 손익 및 랭킹 포스터를 표시할 수 없습니다.";
    return "The TCG Pro ranking snapshot is unavailable, so the PnL and ranking poster cannot be shown.";
  }
  return error.message;
}

function sbtDiagnosticText(profile: TcgProfileData, lang: Language): string {
  const evidence = profile.sbt_diagnostics;
  if (!evidence) return "";
  if (evidence.status === "all_minted_sbt_burned") {
    if (lang === "zh-Hant") return `鏈上證據：共鑄造 ${evidence.minted_total.toLocaleString()} 枚、銷毀 ${evidence.burned_total.toLocaleString()} 枚，所以目前 SBT 餘額是 0。`;
    if (lang === "zh-Hans") return `链上证据：共铸造 ${evidence.minted_total.toLocaleString()} 枚、销毁 ${evidence.burned_total.toLocaleString()} 枚，所以目前 SBT 余额是 0。`;
    if (lang === "ko") return `온체인 기록상 ${evidence.minted_total.toLocaleString()}개가 발행되고 ${evidence.burned_total.toLocaleString()}개가 소각되어 현재 SBT 잔액은 0입니다.`;
    return `On-chain evidence: ${evidence.minted_total.toLocaleString()} minted and ${evidence.burned_total.toLocaleString()} burned, so the current SBT balance is 0.`;
  }
  if (evidence.status === "no_sbt_transfer_history") {
    if (lang === "zh-Hant") return "鏈上沒有找到這個錢包的 SBT 轉移紀錄，所以目前餘額是 0。";
    if (lang === "zh-Hans") return "链上没有找到这个钱包的 SBT 转移记录，所以目前余额是 0。";
    if (lang === "ko") return "이 지갑의 온체인 SBT 전송 기록이 없어 현재 잔액은 0입니다.";
    return "No on-chain SBT transfer history was found for this wallet, so the current balance is 0.";
  }
  if (lang === "zh-Hant") return `鏈上目前 SBT 餘額是 0；歷史共收到 ${evidence.received_total.toLocaleString()} 枚、送出或銷毀 ${evidence.sent_total.toLocaleString()} 枚。`;
  if (lang === "zh-Hans") return `链上目前 SBT 余额是 0；历史共收到 ${evidence.received_total.toLocaleString()} 枚、送出或销毁 ${evidence.sent_total.toLocaleString()} 枚。`;
  if (lang === "ko") return `현재 온체인 SBT 잔액은 0입니다. 기록상 ${evidence.received_total.toLocaleString()}개를 받고 ${evidence.sent_total.toLocaleString()}개를 보내거나 소각했습니다.`;
  return `The current on-chain SBT balance is 0; history shows ${evidence.received_total.toLocaleString()} received and ${evidence.sent_total.toLocaleString()} sent or burned.`;
}

export function ProfileView({ lang }: ProfileViewProps) {
  const copy = COPY[lang];
  const [wallet, setWallet] = useState("");
  const [profiles, setProfiles] = useState<Partial<Record<ProfilePosterKind, TcgProfileData>>>({});
  const [queriedWallet, setQueriedWallet] = useState("");
  const [activePoster, setActivePoster] = useState<ProfilePosterKind>("collection");
  const [loadingPoster, setLoadingPoster] = useState<ProfilePosterKind | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const profile = profiles[activePoster] ?? null;

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setProfiles({});
    setQueriedWallet("");
    setStatus("");
    setError("");
    setLoadingPoster(null);
  }, [lang]);

  async function requestPoster(kind: ProfilePosterKind, normalized: string) {
    const existing = queriedWallet === normalized ? profiles[kind] : undefined;
    setActivePoster(kind);
    if (existing) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setLoadingPoster(null);
      setError("");
      setStatus(`${profilePosterLabel(lang, kind)} · ${copy.local}`);
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), TCG_PROFILE_REQUEST_TIMEOUT_MS);
    const started = performance.now();
    if (queriedWallet !== normalized) {
      setProfiles({});
      setQueriedWallet(normalized);
    }
    setLoadingPoster(kind);
    setError("");
    setStatus(`${copy.loading} ${profilePosterLabel(lang, kind)}…`);
    try {
      const nextProfile = await fetchTcgProfile(normalized, lang, kind, controller.signal);
      if (controllerRef.current !== controller) return;
      setProfiles((current) => ({ ...current, [kind]: nextProfile }));
      const seconds = Math.max(0.1, (performance.now() - started) / 1000);
      setStatus(`${profilePosterLabel(lang, kind)} · ${copy.done} · ${seconds.toFixed(1)}s · ${nextProfile.cache === "hit" ? copy.cached : copy.live}`);
    } catch (requestError) {
      if (controller.signal.aborted) {
        if (controllerRef.current === controller) setError(requestErrorText(new Error("Profile lookup timeout"), lang));
      }
      else if (controllerRef.current === controller) {
        setError(requestError instanceof Error ? requestErrorText(requestError, lang) : "Profile lookup failed");
      }
      if (controllerRef.current === controller) setStatus("");
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoadingPoster(null);
      }
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeProfileWallet(wallet);
    if (!normalized) {
      setError(copy.invalid);
      setStatus("");
      return;
    }
    await requestPoster(activePoster, normalized);
  }

  function onWalletChange(nextWallet: string) {
    setWallet(nextWallet);
    if (queriedWallet && normalizeProfileWallet(nextWallet) !== queriedWallet) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setProfiles({});
      setQueriedWallet("");
      setStatus("");
      setError("");
      setLoadingPoster(null);
    }
  }

  function onPosterSelect(kind: ProfilePosterKind) {
    setActivePoster(kind);
    const normalized = normalizeProfileWallet(wallet);
    if (!normalized || queriedWallet !== normalized) {
      setStatus("");
      setError("");
      return;
    }
    void requestPoster(kind, normalized);
  }

  return <section className="community-hub-view community-profile-view is-active is-entering">
    <ViewHeader eyebrow="TCG PRO · PROFILE" title={copy.title} lead={copy.lead} />
    <form className="community-profile-search community-profile-entry" style={{ "--entry-index": 1 } as CSSProperties} onSubmit={onSubmit}>
      <label htmlFor="community-profile-wallet">{copy.label}</label>
      <div><input id="community-profile-wallet" autoComplete="off" disabled={loadingPoster !== null} inputMode="text" placeholder={copy.placeholder} spellCheck={false} value={wallet} onChange={(event) => onWalletChange(event.target.value)} /><button type="submit" disabled={loadingPoster !== null}><Icon name={loadingPoster ? "loader-circle" : "sparkles"} /><span>{copy.submit}</span></button></div>
      <p className={error ? "is-error" : status ? "is-success" : ""} role="status">{error || status}</p>
    </form>

    <nav className="community-profile-poster-tabs community-profile-entry" style={{ "--entry-index": 2 } as CSSProperties} aria-label="Profile posters">{TCG_PROFILE_POSTER_KINDS.map((kind) => <button className={activePoster === kind ? "is-active" : ""} disabled={loadingPoster !== null} key={kind} type="button" onClick={() => onPosterSelect(kind)} aria-current={activePoster === kind ? "page" : undefined}><Icon name={loadingPoster === kind ? "loader-circle" : kind === "history" ? "chart-no-axes-combined" : kind === "collection" ? "gallery-vertical-end" : "sparkles"} /><span>{profilePosterLabel(lang, kind)}</span></button>)}</nav>

    {profile ? <div className="community-profile-result community-profile-entry" style={{ "--entry-index": 3 } as CSSProperties}>
      {profile.warnings.length ? <aside className="community-profile-warning"><Icon name="triangle-alert" /><div><strong>{copy.warning}</strong>{profile.warnings.map((warning, index) => <p key={`${warning.code ?? "warning"}-${index}`}>{warningText(warning.code, warning.message, lang)}</p>)}</div></aside> : null}
      {profile.sbt_diagnostics && profile.metrics.sbt_total === 0 ? <aside className="community-profile-sbt-evidence"><Icon name="badge-check" /><p>{sbtDiagnosticText(profile, lang)}</p></aside> : null}
      <div className="community-profile-poster-stage"><ProfilePoster kind={activePoster} lang={lang} profile={profile} /></div>
    </div> : null}
  </section>;
}
