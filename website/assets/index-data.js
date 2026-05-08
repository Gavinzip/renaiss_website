    const sbtIconBase = "https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com/SBT/minified/";

    const sbtRows = [
      {
        name: "Discord Linker / X Linker",
        badge: "✅ Available",
        status: "available",
        difficulty: 1,
        requirement: "綁定 X 與 Discord 帳號；可用 X 註冊，或在 Profile → Settings 補綁。",
        icons: ["13-discord-linker.png", "12-x-linker-new.png"],
      },
      {
        name: "Fund Your Account",
        badge: "✅ Available",
        status: "available",
        difficulty: 1,
        requirement: "透過 BSC 至少充值 60 USDT；錢包另留少量 BNB 作 Gas。",
        icons: ["14-fund-your-account.png"],
      },
      {
        name: "Pack Opener",
        badge: "✅ Available",
        status: "available",
        difficulty: 2,
        requirement: "任一卡池累計開包 ≥ 5 次，不同卡池可累計。",
        icons: ["2-pack-opener.png"],
      },
      {
        name: "The Trader",
        badge: "✅ Available",
        status: "available",
        difficulty: 2,
        requirement: "在 Marketplace 完成 3 次卡牌交易；買入或賣出都算，開包不算。",
        icons: ["1-the-trader.png"],
      },
      {
        name: "The Recruiter",
        badge: "✅ Available",
        status: "available",
        difficulty: 3,
        requirement: "使用你的邀請連結，成功邀請 5 位以上新用戶加入並活躍。",
        icons: ["3-the-recruiter.png"],
      },
      {
        name: "Sequential Cert",
        badge: "✅ Available",
        status: "available",
        difficulty: 4,
        requirement: "持有符合條件的連續編號 PSA 認證稀有卡，並在 X 分享。",
        icons: ["108-sequential-cert.png"],
      },
      {
        name: "Mystic Luck",
        badge: "✅ Available",
        status: "available",
        difficulty: 4,
        requirement: "抽到 Tier A 或以上卡牌，錄製並分享抽卡影片。",
        icons: ["95-mystic-luck.png"],
      },
      {
        name: "Omega Pack",
        badge: "✅ Available",
        status: "available",
        difficulty: 2,
        requirement: "在無限卡池 OMEGA 至少開 1 包；每次約 48U。",
        icons: ["76-omega-pack.png"],
      },
      {
        name: "Renacrypt Pack",
        badge: "✅ Available",
        status: "available",
        difficulty: 2,
        requirement: "在無限卡池 RenaCrypt Pack 至少開 1 包；每次約 88U。",
        icons: ["75-renacrypt-pack.png"],
      },
      {
        name: "Discord Server Booster",
        badge: "✅ Available",
        status: "available",
        difficulty: 2,
        requirement: "為 Renaiss Discord 伺服器 Boost 至少 1 次。",
        icons: ["43-discord-server-booster.png"],
      },
      {
        name: "Community Event MVP",
        badge: "✅ Available",
        status: "available",
        difficulty: 3,
        requirement: "參與社群組織的活動，並被選為活動 MVP / 優勝者。",
        icons: ["63-community-event-mvp.png"],
      },
      {
        name: "Community Voice",
        badge: "✅ Available",
        status: "available",
        difficulty: 4,
        requirement: "每月 22 號快照；X 累計 8 篇高品質 Renaiss 內容，並提交到 Discord Mission Submit。",
        icons: ["4-community-voice.png"],
      },
      {
        name: "S+ Breaker",
        badge: "✅ Available",
        status: "available",
        difficulty: 5,
        requirement: "在任一卡池抽出 S 級 / 頂級卡牌，極度看運氣。",
        icons: ["22-s-plus-breaker.png"],
      },
      {
        name: "Grand Ripper",
        badge: "✅ Available",
        status: "available",
        difficulty: 5,
        requirement: "累計完成 200 次以上開包；成本高，建議量力而為。",
        icons: ["34-grand-ripper.png"],
      },
      {
        name: "Signal Booster",
        badge: "✅ Available",
        status: "available",
        difficulty: 2,
        requirement: "用心互動官方或創始人貼文；高品質評論被創始人 / 團隊選中。",
        icons: ["39-signal-booster.png"],
      },
      {
        name: "Contributor of the Week",
        badge: "✅ Available",
        status: "available",
        difficulty: 4,
        requirement: "被 Renaiss 團隊選為當週 top contributor / 週度貢獻者。",
        icons: ["96-contributor-of-the-week.png"],
      },
      {
        name: "Community Developer",
        badge: "✅ Available",
        status: "available",
        difficulty: 4,
        requirement: "為 Renaiss 建工具、App、插件或 AI 系統；到官方 Discord 開 Tool Apply 票提交並被認可。",
        icons: ["44-community-dev.png"],
      },
      {
        name: "Community Event Organizer",
        badge: "✅ Available",
        status: "available",
        difficulty: 4,
        requirement: "主辦並提交一場讓 Renaiss 成員參與的社群活動；活動前到官方 Discord 開 Event Apply 票申請。",
        icons: ["65-community-event-organizer.png"],
      },
      {
        name: "Infinite Pioneer / Grinder / Flash Mint",
        badge: "❌ Event",
        status: "closed",
        requirement: "無限扭蛋 Beta 時段限定任務。",
        icons: ["45-infinite-pioneer.png", "46-infinite-grinder.png", "47-infinite-flash-mint.png"],
      },
      {
        name: "Legacy Flash Mint / Triple Pull",
        badge: "❌ Event",
        status: "closed",
        requirement: "Legacy Pack 3.0 時間窗任務。",
        icons: ["52-legacy-flash-mint.png", "51-legacy-triple-pull.png"],
      },
      {
        name: "The Vanguard",
        badge: "✅ Available",
        status: "available",
        difficulty: 4,
        requirement: "加入 Renaiss 大使計畫，通常需申請並具備持續社群影響力。",
        icons: ["33-the-vanguard.png"],
      },
      {
        name: "2025 Year Awards 系列",
        badge: "❌ Closed",
        status: "closed",
        requirement: "年終評選相關（Hall of Fame, Conviction Holder 等）。",
        icons: [
          "21-hall-of-fame-new.png",
          "26-conviction-holder.png",
          "28-signal-amplifier.png",
          "29-core-contributor.png",
          "23-growth-catalyst.png",
          "27-narrative-builder.png",
          "30-real-grinder.png",
          "24-referral-force.png",
          "25-speed-of-hands.png",
          "31-the-unluckiest-ripper.png",
        ],
      },
    ];

    function sbtStatusClass(status) {
      if (status === "available") return "s-on";
      if (status === "invite") return "s-soon";
      if (status === "unknown") return "s-unknown";
      return "s-off";
    }

    function sbtIconSrc(file) {
      if (/^(?:https?:)?\/\//i.test(file)) return file;
      return `${sbtIconBase}${file}`;
    }

    function sbtDifficultyStars(difficulty) {
      return Array.from({ length: 5 }, (_, index) => {
        const filled = index < difficulty;
        return `<span class="${filled ? "is-filled" : "is-empty"}" aria-hidden="true">${filled ? "★" : "☆"}</span>`;
      }).join("");
    }

    function sbtDifficultyHtml(row) {
      const difficulty = Math.max(0, Math.min(5, Number(row && row.difficulty) || 0));
      if (!difficulty) return "";
      return `
        <span class="sbt-difficulty" aria-label="難度 ${difficulty} / 5">
          <span class="sbt-difficulty-label">難度</span>
          <span class="sbt-stars">${sbtDifficultyStars(difficulty)}</span>
        </span>
      `;
    }

    function sbtFileMeta(fileName) {
      const match = fileName.match(/^(\d+)-(.*)\.png$/i);
      const id = match ? match[1] : "--";
      const rawSlug = (match ? match[2] : fileName.replace(/\.png$/i, ""))
        .replace(/-new$/i, "")
        .replace(/-v2$/i, "");
      const title = rawSlug
        .split("-")
        .filter(Boolean)
        .map((part) => {
          const upper = part.toUpperCase();
          if (upper === "SBT") return "SBT";
          if (upper === "RNG") return "RNG";
          if (upper === "AMA") return "AMA";
          if (upper === "CEO") return "CEO";
          if (upper === "BNB") return "BNB";
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(" ");
      return { id, title };
    }

    async function renderSbtGroups() {
      const availableList = document.getElementById("sbt-available-list");
      const availableCount = document.getElementById("sbt-available-count");
      const unavailableList = document.getElementById("sbt-unavailable-list");
      const unavailableCount = document.getElementById("sbt-unavailable-count");
      if (!availableList || !availableCount) return;

      let availableTotal = 0;
      let unavailableTotal = 0;

      sbtRows.forEach((row) => {
        const item = document.createElement("article");
        item.className = "sbt-item";

        const iconsHtml = row.icons
          .map((file) => {
            const src = sbtIconSrc(file);
            return `
              <a class="sbt-thumb" href="${src}" target="_blank" rel="noreferrer">
                <img loading="lazy" src="${src}" alt="${row.name}" />
              </a>
            `;
          })
          .join("");

        item.innerHTML = `
          <div class="sbt-item-icons">${iconsHtml}</div>
          <div class="sbt-item-main">
            <div class="sbt-item-top">
              <div class="sbt-item-name">${row.name}</div>
              <div class="sbt-item-badges">
                ${sbtDifficultyHtml(row)}
                <span class="status ${sbtStatusClass(row.status)}">${row.badge}</span>
              </div>
            </div>
            <p class="sbt-item-req">${row.requirement}</p>
          </div>
        `;

        if (row.status === "available") {
          availableTotal += 1;
          availableList.appendChild(item);
        } else if (unavailableList) {
          unavailableTotal += 1;
          unavailableList.appendChild(item);
        }
      });

      availableCount.innerHTML = `<iconify-icon icon="lucide:clock-3"></iconify-icon>${availableTotal} items`;
      if (unavailableCount) {
        unavailableCount.innerHTML = `<iconify-icon icon="lucide:archive-x"></iconify-icon>${unavailableTotal} items`;
      }
    }

    function escapeHtml(text) {
      return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    const INTEL_LANG_STORAGE_KEY = "intel_ui_lang";
    const INTEL_LANGS = ["zh-Hant", "zh-Hans", "en", "ko"];

    function normalizeUiLang(raw) {
      const text = String(raw || "").trim().toLowerCase();
      if (!text) return "zh-Hant";
      if (text.startsWith("zh-hant") || text === "zh-tw" || text === "zh-hk" || text === "zh-mo") return "zh-Hant";
      if (text.startsWith("zh")) return "zh-Hans";
      if (text.startsWith("ko")) return "ko";
      if (text.startsWith("en")) return "en";
      return "zh-Hant";
    }

    function langToLocale(langTag) {
      const tag = normalizeUiLang(langTag);
      if (tag === "zh-Hans") return "zh-CN";
      if (tag === "en") return "en-US";
      if (tag === "ko") return "ko-KR";
      return "zh-TW";
    }

    function loadSavedLang() {
      let raw = "";
      try {
        raw = String(localStorage.getItem(INTEL_LANG_STORAGE_KEY) || "").trim();
      } catch (_error) {
        raw = "";
      }
      return normalizeUiLang(raw || document.documentElement.lang || navigator.language || "zh-Hant");
    }

    let currentUiLang = loadSavedLang();
    document.documentElement.lang = currentUiLang;
    let langFeedRefreshTimer = null;

    function saveUiLang(lang) {
      const tag = normalizeUiLang(lang);
      currentUiLang = tag;
      document.documentElement.lang = tag;
      try {
        localStorage.setItem(INTEL_LANG_STORAGE_KEY, tag);
      } catch (_error) {
      }
      return tag;
    }

    function toLocalTime(isoLike) {
      const dt = isoLike ? new Date(isoLike) : null;
      if (!dt || Number.isNaN(dt.valueOf())) return "--";
      return dt.toLocaleString(langToLocale(currentUiLang), { hour12: false });
    }

    function toPosterDate(isoLike) {
      const dt = isoLike ? new Date(isoLike) : null;
      if (!dt || Number.isNaN(dt.valueOf())) return "--";
      return dt.toLocaleDateString(langToLocale(currentUiLang), { month: "2-digit", day: "2-digit", weekday: "short" });
    }

    function todayLabelText() {
      const now = new Date();
      const locale = langToLocale(currentUiLang);
      const lead = currentUiLang === "en" ? "Today" : (currentUiLang === "ko" ? "오늘" : "今日");
      return `・${lead} ${now.toLocaleDateString(locale, { month: "2-digit", day: "2-digit", weekday: "short" })}`;
    }

    const intelMasterTimelineState = {
      items: [],
      index: 0,
      dragStartX: 0,
      dragCurrentX: 0,
      dragStartAt: 0,
      dragSamples: [],
      dragging: false,
      pointerId: null,
      animating: false,
      wheelAccum: 0,
      wheelLockedUntil: 0,
      flingTailTimer: null,
    };
    const intelAnalyzeState = {
      pollTimer: null,
      jobId: "",
    };
    let intelFeedCache = null;
    const intelFeedLangCache = new Map();
    const intelAuthState = {
      ready: false,
      authRequired: true,
      authConfigured: false,
      authenticated: false,
      user: "",
      mode: "",
      error: "",
      checking: false,
    };
    const intelFeedbackLabels = new Set([
      "event", "feature", "announcement", "market", "report", "insight",
      "trend",
      "events", "official", "sbt", "pokemon", "collectibles", "alpha", "guides", "community", "other",
      "exclude",
    ]);
    const INTEL_ANALYZE_JOB_KEY = "intel_analyze_job_id";
    const intelCardLookup = new Map();
    const intelAdminState = {
      pollTimer: null,
      fetching: false,
      lastPayload: null,
    };
    let intelFeedbackModalResolver = null;
    let pokemonNewsPollTimer = null;
    let pokemonNewsItemsState = [];
    const DEFAULT_INTEL_API_BASE = "https://renaiss.zeabur.app";

    function normalizeIntelApiBase(raw) {
      return String(raw || "").trim().replace(/\/+$/, "");
    }

    function isLocalIntelPreviewHost(hostname) {
      const host = String(hostname || "").toLowerCase();
      return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
    }

    function isAllowedIntelApiBase(base, localPreview) {
      const value = normalizeIntelApiBase(base);
      if (!value) return false;
      if (value === DEFAULT_INTEL_API_BASE) return true;
      if (localPreview && /^http:\/\/(127\.0\.0\.1|localhost):8787$/i.test(value)) return true;
      return false;
    }

    function detectIntelApiBase() {
      const isLocal = isLocalIntelPreviewHost(window.location?.hostname || "");
      try {
        const win = window || {};
        const params = new URLSearchParams(String(window.location?.search || ""));
        const fromQuery = normalizeIntelApiBase(params.get("intel_api_base") || "");
        if (fromQuery && isAllowedIntelApiBase(fromQuery, isLocal)) {
          window.localStorage.setItem("intel_api_base", fromQuery);
          return fromQuery;
        }
        if (fromQuery) {
          window.localStorage.removeItem("intel_api_base");
        }
        const explicit = normalizeIntelApiBase(win.__INTEL_API_BASE__ || "");
        if (explicit && isAllowedIntelApiBase(explicit, isLocal)) {
          return explicit;
        }
        const stored = normalizeIntelApiBase(window.localStorage.getItem("intel_api_base") || "");
        if (stored && isAllowedIntelApiBase(stored, isLocal)) {
          return stored;
        }
        if (stored) {
          window.localStorage.removeItem("intel_api_base");
        }
      } catch (_err) {}
      if (isLocal) {
        return "http://127.0.0.1:8787";
      }
      return DEFAULT_INTEL_API_BASE;
    }
    const INTEL_API_BASE = detectIntelApiBase();

    function clampMasterIndex(index, len) {
      if (!len) return 0;
      return Math.max(0, Math.min(len - 1, index));
    }

    function normalizeTimelineDate(item) {
      const raw = String(item?.timeline_date || "");
      if (!raw) return null;
      const dt = new Date(raw);
      if (Number.isNaN(dt.valueOf())) return null;
      return dt;
    }

    function parseLooseTimelineDate(text, baseDateLike) {
      const src = String(text || "").trim();
      if (!src) return null;
      const lower = src.toLowerCase();
      const base = baseDateLike ? new Date(baseDateLike) : new Date();
      const baseValid = !Number.isNaN(base.valueOf()) ? base : new Date();
      const year = baseValid.getFullYear();

      if (/(?:^|[\s,，。])(?:today|tonight|今天|今晚)(?:$|[\s,，。])/i.test(src)) {
        return new Date(Date.UTC(year, baseValid.getMonth(), baseValid.getDate()));
      }
      if (/(?:^|[\s,，。])(?:tomorrow|明天)(?:$|[\s,，。])/i.test(src)) {
        const dt = new Date(baseValid);
        dt.setDate(dt.getDate() + 1);
        return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      }

      const monthMap = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      const en = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i);
      if (en) {
        const mon = monthMap[String(en[1]).slice(0, 3)] ?? null;
        const day = Number(en[2]);
        if (mon !== null && day >= 1 && day <= 31) {
          return new Date(Date.UTC(year, mon, day));
        }
      }

      const slash = src.match(/\b(?:20\d{2}\/)?(\d{1,2})\/(\d{1,2})\b/);
      if (slash) {
        const mon = Number(slash[1]) - 1;
        const day = Number(slash[2]);
        if (mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
          return new Date(Date.UTC(year, mon, day));
        }
      }

      const zh = src.match(/(?:20\d{2}\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|號|号)?/);
      if (zh) {
        const mon = Number(zh[1]) - 1;
        const day = Number(zh[2]);
        if (mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
          return new Date(Date.UTC(year, mon, day));
        }
      }

      return null;
    }

    function resolveMasterTimelineDate(item) {
      const direct = normalizeTimelineDate(item);
      if (direct instanceof Date && !Number.isNaN(direct.valueOf())) return direct;

      const publishedAt = String(item?.published_at || "").trim();
      const fromFacts = parseLooseTimelineDate(String(item?.event_facts?.schedule || ""), publishedAt);
      if (fromFacts instanceof Date && !Number.isNaN(fromFacts.valueOf())) return fromFacts;

      const blob = `${String(item?.title || "")} ${String(item?.summary || "")} ${String(item?.raw_text || "")}`;
      const fromText = parseLooseTimelineDate(blob, publishedAt);
      if (fromText instanceof Date && !Number.isNaN(fromText.valueOf())) return fromText;

      const cardType = String(item?.card_type || "").toLowerCase();
      if (["event", "feature", "announcement"].includes(cardType) && publishedAt) {
        const dt = new Date(publishedAt);
        if (!Number.isNaN(dt.valueOf())) {
          return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
        }
      }
      return null;
    }

    function resolveExplicitTimelineDate(item) {
      const direct = normalizeTimelineDate(item);
      if (direct instanceof Date && !Number.isNaN(direct.valueOf())) return direct;

      const publishedAt = String(item?.published_at || "").trim();
      const fromFacts = parseLooseTimelineDate(String(item?.event_facts?.schedule || ""), publishedAt);
      if (fromFacts instanceof Date && !Number.isNaN(fromFacts.valueOf())) return fromFacts;

      const blob = `${String(item?.title || "")} ${String(item?.summary || "")} ${String(item?.raw_text || "")}`;
      const fromText = parseLooseTimelineDate(blob, publishedAt);
      if (fromText instanceof Date && !Number.isNaN(fromText.valueOf())) return fromText;
      return null;
    }

    function hasFutureReleaseSignal(item) {
      const blob = cardTextBlob(item);
      if (!blob) return false;
      const futureRe = /(即將|將於|預計|预计|soon|upcoming|on the way|targeted|next round|next phase|coming soon|launch(?:ing)? soon|release(?:ing)? soon|late\s+[a-z]+|early\s+[a-z]+)/i;
      const liveRe = /(now live|is now live|already live|you can now|已上線|已开放|已開放|已發布|現已可用)/i;
      if (liveRe.test(blob) && !futureRe.test(blob)) return false;
      return futureRe.test(blob);
    }

    function hasLiveReleaseSignal(item) {
      const blob = cardTextBlob(item);
      if (!blob) return false;
      return /(now live|is now live|already live|you can now|已上線|已开放|已開放|已發布|現已可用|mfa.*is now live)/i.test(blob);
    }

    function buildMasterTimelineItems(cards) {
      const rows = Array.isArray(cards) ? cards : [];
      const normalizeTopic = (text) => String(text || "")
        .replace(/\s+/g, " ")
        .replace(/^(活動重點|活動快訊|活動速報|功能進度|公告快訊|市場訊號|社群觀點|活動|功能|公告|市場|觀點)\s*[｜|:：\-]\s*/u, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .slice(0, 6)
        .join(" ");
      const eventRows = rows.filter((c) => c?.event_wall === true);
      const inferredDateByTopic = new Map();
      eventRows.forEach((card) => {
        const explicit = resolveExplicitTimelineDate(card);
        if (!(explicit instanceof Date) || Number.isNaN(explicit.valueOf())) return;
        const account = String(card?.account || "").trim().toLowerCase();
        const topicSig = normalizeTopic(card?.title || card?.glance || card?.summary || card?.raw_text || "");
        const key = `${account}|${topicSig}`;
        const prev = inferredDateByTopic.get(key);
        if (!(prev instanceof Date) || Number.isNaN(prev.valueOf())) {
          inferredDateByTopic.set(key, explicit);
          return;
        }
        if (explicit.valueOf() < prev.valueOf()) {
          inferredDateByTopic.set(key, explicit);
        }
      });
      const resolveEventDate = (item) => {
        const explicit = resolveExplicitTimelineDate(item);
        if (explicit instanceof Date && !Number.isNaN(explicit.valueOf())) return explicit;
        const account = String(item?.account || "").trim().toLowerCase();
        const topicSig = normalizeTopic(item?.title || item?.glance || item?.summary || item?.raw_text || "");
        const key = `${account}|${topicSig}`;
        const inferred = inferredDateByTopic.get(key);
        if (inferred instanceof Date && !Number.isNaN(inferred.valueOf())) return inferred;
        return null;
      };
      const baseDate = new Date();
      baseDate.setHours(0, 0, 0, 0);
      const withinTimelineWindow = (dt) => {
        if (!(dt instanceof Date) || Number.isNaN(dt.valueOf())) return false;
        const target = new Date(dt);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.round((target - baseDate) / 86400000);
        return Math.abs(diffDays) <= 7;
      };
      const filtered = rows.filter((c) => {
        if (c?.event_wall !== true) return false;
        const dt = resolveEventDate(c);
        return withinTimelineWindow(dt);
      });
      const itemScore = (card) => {
        let score = 0;
        if (String(card?.cover_image || "").trim()) score += 5;
        if (String(card?.timeline_date || "").trim()) score += 3;
        if (String(card?.event_facts?.schedule || "").trim()) score += 2;
        if (String(card?.event_facts?.reward || "").trim()) score += 1.2;
        if (String(card?.event_facts?.participation || "").trim()) score += 0.8;
        if (Array.isArray(card?.bullets) && card.bullets.length) score += 0.6;
        score += Math.min(2, String(card?.summary || "").length / 220);
        score += toTimestamp(card?.published_at) / 1e13;
        return score;
      };
      const bySig = new Map();
      filtered.forEach((card) => {
        const dt = resolveEventDate(card);
        if (!(dt instanceof Date) || Number.isNaN(dt.valueOf())) return;
        const dateSig = dt.toISOString().slice(0, 10);
        const account = String(card?.account || "").trim().toLowerCase();
        const type = String(card?.card_type || "").trim().toLowerCase();
        const topicSig = normalizeTopic(card?.title || card?.glance || card?.summary || "");
        const sig = `${account}|${type}|${dateSig}|${topicSig}`;
        const prev = bySig.get(sig);
        if (!prev) {
          bySig.set(sig, card);
          return;
        }
        if (itemScore(card) > itemScore(prev)) {
          bySig.set(sig, card);
        }
      });
      const deduped = [...bySig.values()];
      deduped.sort((a, b) => {
        const ad = resolveEventDate(a);
        const bd = resolveEventDate(b);
        const at = ad ? ad.valueOf() : Number.MAX_SAFE_INTEGER;
        const bt = bd ? bd.valueOf() : Number.MAX_SAFE_INTEGER;
        if (at !== bt) return at - bt;
        const ap = new Date(String(a?.published_at || 0)).valueOf();
        const bp = new Date(String(b?.published_at || 0)).valueOf();
        return ap - bp;
      });
      return deduped;
    }

    function currentTimelineBucket(dt) {
      if (!dt || Number.isNaN(dt.valueOf())) {
        if (currentUiLang === "en") return "TBD";
        if (currentUiLang === "ko") return "미정";
        if (currentUiLang === "zh-Hans") return "未定";
        return "未定";
      }
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const target = new Date(dt);
      target.setHours(0, 0, 0, 0);
      const diff = Math.round((target - now) / 86400000);
      if (diff > 0) {
        if (currentUiLang === "en") return `Future D-${diff}`;
        if (currentUiLang === "ko") return `예정 D-${diff}`;
        return `未來 D-${diff}`;
      }
      if (diff === 0) {
        if (currentUiLang === "en") return "Today";
        if (currentUiLang === "ko") return "오늘";
        return "今天";
      }
      if (currentUiLang === "en") return `Past D+${Math.abs(diff)}`;
      if (currentUiLang === "ko") return `지난 D+${Math.abs(diff)}`;
      return `過往 D+${Math.abs(diff)}`;
    }

    function categoryLabel(cardType) {
      const raw = String(cardType || "").trim();
      return uiLabel(raw) || uiLabel("intelligence");
    }

    function pickInitialMasterIndex(items) {
      if (!items.length) return 0;
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      // 預設優先鎖定「今天的活動」，避免直接跳到明天或未來功能。
      const todayEventCandidates = items
        .map((item, idx) => ({ item, idx, dt: resolveMasterTimelineDate(item) }))
        .filter(({ item, dt }) => {
          if (!(dt instanceof Date) || Number.isNaN(dt.valueOf())) return false;
          return String(item?.card_type || "") === "event" && dt >= todayStart && dt < tomorrowStart;
        })
        .sort((a, b) => {
          const ap = toTimestamp(a.item?.published_at);
          const bp = toTimestamp(b.item?.published_at);
          return bp - ap;
        });
      if (todayEventCandidates.length) return todayEventCandidates[0].idx;

      const foundTodayOrFuture = items.findIndex((x) => {
        const dt = resolveMasterTimelineDate(x);
        return dt instanceof Date && !Number.isNaN(dt.valueOf()) && dt >= todayStart;
      });
      if (foundTodayOrFuture >= 0) return foundTodayOrFuture;

      return 0;
    }

    function timelineTopic(item) {
      const raw = String(item?.title || item?.glance || item?.summary || "")
        .replace(/\s+/g, " ")
        .replace(/^(活動重點|活動快訊|活動速報|功能進度|公告快訊|市場訊號|社群觀點|活動|功能|公告|市場|觀點)\s*[｜|:：\-]\s*/u, "")
        .trim();
      const type = categoryLabel(item?.card_type);
      if (!raw) return `${type}｜未命名`;
      const body = raw.length > 14 ? `${raw.slice(0, 14)}...` : raw;
      return `${type}｜${body}`;
    }

    function isOfficialTimelineEvent(item) {
      const account = String(item?.account || "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();
      const officialAccounts = new Set(["renaissxyz", "renaisxzy"]);
      const officialDiscordChannelIds = new Set(["1478788250687766796"]);
      const url = String(item?.url || item?.source_url || "");
      const id = String(item?.id || "");
      const channelFromId = id.match(/^discord-(\d+)-\d+$/i)?.[1] || "";
      const channelFromUrl = url.match(/discord\.com\/channels\/(?:@me|\d+)\/(\d+)\/\d+/i)?.[1] || "";
      const isOfficialAccount = officialAccounts.has(account) || /(?:^|\/)renaissxyz(?:\/|$)/i.test(url);
      const isOfficialDiscordChannel = officialDiscordChannelIds.has(channelFromId)
        || officialDiscordChannelIds.has(channelFromUrl);
      return Boolean(isOfficialAccount || isOfficialDiscordChannel);
    }

    function isTodayTimelineDate(dt) {
      if (!dt || Number.isNaN(dt.valueOf())) return false;
      const now = new Date();
      return now.getFullYear() === dt.getFullYear()
        && now.getMonth() === dt.getMonth()
        && now.getDate() === dt.getDate();
    }

    function cleanMasterTitle(rawText) {
      return String(rawText || "")
        .replace(/\s+/g, " ")
        .replace(/^(活動重點|活動快訊|活動速報|功能進度|公告快訊|市場訊號|社群觀點|活動|功能|公告|市場|觀點)\s*[｜|:：\-]\s*/u, "")
        .trim();
    }

    function cleanMasterSummary(rawText) {
      const text = String(rawText || "").replace(/\s+/g, " ").trim();
      if (!text) return "";
      const stripped = text
        .replace(/^這則內容(?:偏向|屬於)[^。！？!?]*[。！？!?]\s*/u, "")
        .replace(/^可辨識時間資訊[:：]\s*/u, "時間：")
        .replace(/建議[^。！？!?]*[。！？!?]\s*$/u, "")
        .trim();
      if (!stripped || stripped.length < 8) return "";
      return stripped;
    }

    const intelTypeLabelMap = {
      event: "活動",
      market: "市場",
      trend: "收藏趨勢",
      report: "報告",
      announcement: "公告",
      feature: "功能",
      insight: "觀點",
    };

    const UI_LABELS = {
      "zh-Hant": {
        intelligence: "情報",
        event: "活動",
        market: "市場",
        report: "報告",
        announcement: "公告",
        feature: "功能",
        insight: "觀點",
        trend: "收藏趨勢",
        official: "官方",
        pokemon: "寶可夢",
        collectibles: "收藏趨勢",
        alpha: "未來規劃",
        guides: "攻略",
        tools: "攻略",
        community: "社群精選",
        other: "無",
        published: "發布",
        eventDate: "事件",
        sourceOriginal: "原文",
        originalSource: "原始來源",
        oneLine: "一句話重點",
        eventInfo: "活動資訊",
        quickPoints: "快速重點",
        aiDeepDive: "AI 深入整理",
        categoryTags: "分類標籤",
        keep: "保留",
        kept: "已保留",
        pin: "頂選",
        pinned: "已頂選",
        bottom: "置底",
        bottomed: "已置底",
        exclude: "排除",
        feedback: "回饋分類",
        detail: "詳細",
        unnamedTimeline: "未命名時間點",
        unnamedPost: "未命名貼文",
        noTimeline: "目前沒有可顯示的活動/功能時間軸資料。",
        noHighlights: "目前沒有可用重點條列。",
        noExpanded: "目前沒有可用的展開整理。",
        noImage: "此貼文沒有可用圖片，仍可看下方完整整理。",
        clickForDetail: "點開可查看完整 AI 整理、原文連結與圖片。",
        alphaSlots: "Alpha 四格整理",
        eventSlots: "活動四格整理",
        marketSlots: "市場四格整理",
        reportSlots: "工具/攻略四格整理",
        generalSlots: "重點四格整理",
        whenOnline: "何時上線",
        whatChanged: "改了什麼",
        affected: "影響誰",
        nextFirst: "先做什麼",
        whenJoin: "何時參加",
        whereJoin: "在哪參加",
        rewardGet: "你能拿到",
        coreEvent: "核心事件",
        keyNumber: "關鍵數字",
        impact: "影響面",
        compareWhat: "在比較什麼",
        keyDiff: "重點差異",
        audienceFit: "適合誰",
        coreTopic: "核心主題",
        contextNow: "當下脈絡",
        yourImpact: "對你的影響",
        nextStep: "下一步",
        reward: "獎勵",
        participation: "參與",
        audience: "對象",
        location: "地點",
        schedule: "時間",
        tbdOfficial: "待官方補充",
        basisFromSource: "以原文公告為準",
        seeSourceTime: "請看原文時間",
        seeSourcePrice: "請看原文中的價格/成交/規模資訊",
        marketUpdate: "市場更新",
        marketImpact: "影響社群對短期市場方向的判讀",
        compareSourcesFirst: "比對多來源後再做決策",
        comparePlanDiff: "重點在比較不同方案差異",
        planAudience: "適合需要快速選方案的人",
        budgetTrial: "先依預算與時程選一個方案試跑",
        contentPending: "內容待補充",
        recentUpdate: "近期更新",
        communityTrackingBasis: "作為社群觀察與後續追蹤依據",
        followSameAccount: "先看原文，再追同帳號後續更新",
        alphaCheckConditions: "先確認開放條件與時間",
        officialPending: "待官方公告",
        updatePending: "更新內容待補充",
        audiencePending: "影響對象待官方補充",
        liveReleased: "已上線",
        sbtAcquisition: "SBT 取得方式",
        sbtAcquisitionNext: "下一步：詳細 → 發布 / 事件",
        sbtAcquisitionEmpty: "目前沒有整理出明確 SBT 取得方式。",
        sbtStatusPending: "待確認",
        sbtStatusClaimable: "可領取",
        sbtStatusExpired: "已過期",
        sbtJumpToCard: "直達卡片",
        snapshotAction: "快照前持續拉分，快照後核對官方最終門檻與 SBT 等級。",
        detailFallbackLead: "目前沒有可用摘要，請看原始貼文。",
        eventBackground: "事件背景",
        timeLocation: "時間地點",
        rewardIncentive: "獎勵與誘因",
        joinMethod: "參與方式",
        possibleImpact: "可能影響",
        sourceRulesFirst: "先看原文確認規則、時間與限制，再決定是否參與。",
        pokemonNews: "寶可夢最新消息",
        keySummary: "重點摘要",
        fullSummary: "完整整理",
        noPokemonNews: "目前沒有可顯示的最新消息。",
        noPokemonPoints: "目前沒有可顯示重點。",
        clickCardFull: "點擊卡片可看完整整理。",
        aiOrganized: "AI整理",
        basicOrganized: "基礎整理",
        source: "來源",
        language: "語言",
        updated: "更新",
        cached: "快取",
        realtime: "即時",
        backgroundUpdating: "背景更新中",
        nextRefresh: "下次",
        loadingNews: "來源：MiniMax NewsAgent · 載入中...",
        updatingNews: "來源：MiniMax NewsAgent · 正在更新最新消息...",
        repairingLoadState: "正在修復載入狀態...",
        repairDoneReloading: "載入狀態已清理，正在重新抓取資料...",
        repairFailed: "修復失敗",
        feedFailedUsingSnapshot: "API 暫時連不上，已沿用上一份成功資料。",
        feedAutoRepaired: "偵測到壞掉的載入狀態，已自動修復並重新抓取。",
      },
      "zh-Hans": {
        intelligence: "情报",
        event: "活动",
        market: "市场",
        report: "报告",
        announcement: "公告",
        feature: "功能",
        insight: "观点",
        trend: "收藏趋势",
        official: "官方",
        pokemon: "宝可梦",
        collectibles: "收藏趋势",
        alpha: "未来规划",
        guides: "攻略",
        tools: "攻略",
        community: "社群精选",
        other: "无",
        published: "发布",
        eventDate: "事件",
        sourceOriginal: "原文",
        originalSource: "原始来源",
        oneLine: "一句话重点",
        eventInfo: "活动信息",
        quickPoints: "快速重点",
        aiDeepDive: "AI 深入整理",
        categoryTags: "分类标签",
        keep: "保留",
        kept: "已保留",
        pin: "顶选",
        pinned: "已顶选",
        bottom: "置底",
        bottomed: "已置底",
        exclude: "排除",
        feedback: "反馈分类",
        detail: "详细",
        unnamedTimeline: "未命名时间点",
        unnamedPost: "未命名贴文",
        noTimeline: "目前没有可显示的活动/功能时间轴资料。",
        noHighlights: "目前没有可用重点条列。",
        noExpanded: "目前没有可用的展开整理。",
        noImage: "此贴文没有可用图片，仍可看下方完整整理。",
        clickForDetail: "点开可查看完整 AI 整理、原文链接与图片。",
        alphaSlots: "Alpha 四格整理",
        eventSlots: "活动四格整理",
        marketSlots: "市场四格整理",
        reportSlots: "工具/攻略四格整理",
        generalSlots: "重点四格整理",
        whenOnline: "何时上线",
        whatChanged: "改了什么",
        affected: "影响谁",
        nextFirst: "先做什么",
        whenJoin: "何时参加",
        whereJoin: "在哪参加",
        rewardGet: "你能拿到",
        coreEvent: "核心事件",
        keyNumber: "关键数字",
        impact: "影响面",
        compareWhat: "在比较什么",
        keyDiff: "重点差异",
        audienceFit: "适合谁",
        coreTopic: "核心主题",
        contextNow: "当下脉络",
        yourImpact: "对你的影响",
        nextStep: "下一步",
        reward: "奖励",
        participation: "参与",
        audience: "对象",
        location: "地点",
        schedule: "时间",
        tbdOfficial: "待官方补充",
        basisFromSource: "以原文公告为准",
        seeSourceTime: "请看原文时间",
        seeSourcePrice: "请看原文中的价格/成交/规模信息",
        marketUpdate: "市场更新",
        marketImpact: "影响社群对短期市场方向的判断",
        compareSourcesFirst: "比对多来源后再做决策",
        comparePlanDiff: "重点在比较不同方案差异",
        planAudience: "适合需要快速选方案的人",
        budgetTrial: "先依预算与时程选一个方案试跑",
        contentPending: "内容待补充",
        recentUpdate: "近期更新",
        communityTrackingBasis: "作为社群观察与后续追踪依据",
        followSameAccount: "先看原文，再追同账号后续更新",
        alphaCheckConditions: "先确认开放条件与时间",
        officialPending: "待官方公告",
        updatePending: "更新内容待补充",
        audiencePending: "影响对象待官方补充",
        liveReleased: "已上线",
        sbtAcquisition: "SBT 获取方式",
        sbtAcquisitionNext: "下一步：详情 → 发布 / 事件",
        sbtAcquisitionEmpty: "目前没有整理出明确 SBT 获取方式。",
        sbtStatusPending: "待确认",
        sbtStatusClaimable: "可领取",
        sbtStatusExpired: "已过期",
        sbtJumpToCard: "直达卡片",
        snapshotAction: "快照前持续拉分，快照后核对官方最终门槛与 SBT 等级。",
        detailFallbackLead: "目前没有可用摘要，请看原始贴文。",
        eventBackground: "事件背景",
        timeLocation: "时间地点",
        rewardIncentive: "奖励与诱因",
        joinMethod: "参与方式",
        possibleImpact: "可能影响",
        sourceRulesFirst: "先看原文确认规则、时间与限制，再决定是否参与。",
        pokemonNews: "宝可梦最新消息",
        keySummary: "重点摘要",
        fullSummary: "完整整理",
        noPokemonNews: "目前没有可显示的最新消息。",
        noPokemonPoints: "目前没有可显示重点。",
        clickCardFull: "点击卡片可看完整整理。",
        aiOrganized: "AI整理",
        basicOrganized: "基础整理",
        source: "来源",
        language: "语言",
        updated: "更新",
        cached: "缓存",
        realtime: "实时",
        backgroundUpdating: "后台更新中",
        nextRefresh: "下次",
        loadingNews: "来源：MiniMax NewsAgent · 加载中...",
        updatingNews: "来源：MiniMax NewsAgent · 正在更新最新消息...",
        repairingLoadState: "正在修复加载状态...",
        repairDoneReloading: "加载状态已清理，正在重新抓取数据...",
        repairFailed: "修复失败",
        feedFailedUsingSnapshot: "API 暂时连不上，已沿用上一份成功数据。",
        feedAutoRepaired: "检测到损坏的加载状态，已自动修复并重新抓取。",
      },
      en: {
        intelligence: "Intel",
        event: "Event",
        market: "Market",
        report: "Report",
        announcement: "Announcement",
        feature: "Feature",
        insight: "Insight",
        trend: "Collectibles",
        official: "Official",
        pokemon: "Pokemon",
        collectibles: "Collectibles",
        alpha: "Future Plans",
        guides: "Guides",
        tools: "Guides",
        community: "Community Picks",
        other: "Unclassified",
        published: "Published",
        eventDate: "Event",
        sourceOriginal: "Source",
        originalSource: "Original Source",
        oneLine: "One-Line Takeaway",
        eventInfo: "Event Info",
        quickPoints: "Quick Points",
        aiDeepDive: "AI Deep Dive",
        categoryTags: "Category Tags",
        keep: "Keep",
        kept: "Kept",
        pin: "Pin",
        pinned: "Pinned",
        bottom: "Move Down",
        bottomed: "Moved Down",
        exclude: "Exclude",
        feedback: "Feedback",
        detail: "Details",
        unnamedTimeline: "Untitled Timeline Item",
        unnamedPost: "Untitled Post",
        noTimeline: "No event timeline data available.",
        noHighlights: "No highlight bullets available yet.",
        noExpanded: "No expanded analysis available yet.",
        noImage: "No image is available for this post. Read the full analysis below.",
        clickForDetail: "Open for the full AI analysis, source link, and images.",
        alphaSlots: "Alpha Four-Point Brief",
        eventSlots: "Event Four-Point Brief",
        marketSlots: "Market Four-Point Brief",
        reportSlots: "Tool / Guide Four-Point Brief",
        generalSlots: "Four-Point Brief",
        whenOnline: "When",
        whatChanged: "What Changed",
        affected: "Who Is Affected",
        nextFirst: "What To Do First",
        whenJoin: "When",
        whereJoin: "Where",
        rewardGet: "Reward",
        coreEvent: "Core Event",
        keyNumber: "Key Number",
        impact: "Impact",
        compareWhat: "What It Compares",
        keyDiff: "Key Difference",
        audienceFit: "Best For",
        coreTopic: "Core Topic",
        contextNow: "Context",
        yourImpact: "Why It Matters",
        nextStep: "Next Step",
        reward: "Reward",
        participation: "How To Join",
        audience: "Audience",
        location: "Location",
        schedule: "Time",
        tbdOfficial: "Waiting for official details",
        basisFromSource: "Use the original post as the source of truth",
        seeSourceTime: "Check the original post for the time",
        seeSourcePrice: "Check the original post for price, sale, or market-size context",
        marketUpdate: "Market Update",
        marketImpact: "This may shift short-term community market expectations",
        compareSourcesFirst: "Compare multiple sources before deciding",
        comparePlanDiff: "Focuses on differences between options",
        planAudience: "Best for people who need to choose quickly",
        budgetTrial: "Pick one option by budget and timeline, then test it",
        contentPending: "Details pending",
        recentUpdate: "Recent update",
        communityTrackingBasis: "Use this as community context and follow-up material",
        followSameAccount: "Read the original post, then track follow-ups from the same account",
        alphaCheckConditions: "Confirm the opening conditions and timing first",
        officialPending: "Waiting for official announcement",
        updatePending: "Update details still need confirmation",
        audiencePending: "Affected users still need official confirmation",
        liveReleased: "Live",
        sbtAcquisition: "SBT acquisition",
        sbtAcquisitionNext: "Next: detail -> publish / event",
        sbtAcquisitionEmpty: "No explicit SBT acquisition method is available yet.",
        sbtStatusPending: "Pending",
        sbtStatusClaimable: "Claimable",
        sbtStatusExpired: "Expired",
        sbtJumpToCard: "Jump to card",
        snapshotAction: "Keep pushing points before the snapshot, then verify the final official threshold and SBT tier.",
        detailFallbackLead: "No usable summary yet. Read the original post.",
        eventBackground: "Background",
        timeLocation: "Time / Location",
        rewardIncentive: "Reward / Incentive",
        joinMethod: "How To Join",
        possibleImpact: "Possible Impact",
        sourceRulesFirst: "Check the original post for rules, timing, and limits before joining.",
        pokemonNews: "Pokemon News",
        keySummary: "Key Summary",
        fullSummary: "Full Brief",
        noPokemonNews: "No news items available yet.",
        noPokemonPoints: "No key points available yet.",
        clickCardFull: "Open the card for the full brief.",
        aiOrganized: "AI brief",
        basicOrganized: "Basic brief",
        source: "Source",
        language: "Language",
        updated: "Updated",
        cached: "cached",
        realtime: "live",
        backgroundUpdating: "background update",
        nextRefresh: "next",
        loadingNews: "Source: MiniMax NewsAgent · Loading...",
        updatingNews: "Source: MiniMax NewsAgent · Updating news...",
        repairingLoadState: "Repairing loading state...",
        repairDoneReloading: "Loading state cleared. Refetching data...",
        repairFailed: "Repair failed",
        feedFailedUsingSnapshot: "API is temporarily unavailable. Using the last successful data.",
        feedAutoRepaired: "Detected a broken loading state. Repaired and refetched data.",
      },
      ko: {
        intelligence: "정보",
        event: "이벤트",
        market: "시장",
        report: "리포트",
        announcement: "공지",
        feature: "기능",
        insight: "관점",
        trend: "컬렉터블 트렌드",
        official: "공식",
        pokemon: "포켓몬",
        collectibles: "컬렉터블 트렌드",
        alpha: "미래 계획",
        guides: "가이드",
        tools: "가이드",
        community: "커뮤니티 픽",
        other: "미분류",
        published: "게시",
        eventDate: "이벤트",
        sourceOriginal: "원문",
        originalSource: "원본 출처",
        oneLine: "한 줄 요약",
        eventInfo: "이벤트 정보",
        quickPoints: "핵심 요점",
        aiDeepDive: "AI 상세 정리",
        categoryTags: "분류 태그",
        keep: "보관",
        kept: "보관됨",
        pin: "상단 고정",
        pinned: "고정됨",
        bottom: "아래로",
        bottomed: "아래 배치됨",
        exclude: "제외",
        feedback: "분류 피드백",
        detail: "상세",
        unnamedTimeline: "제목 없는 타임라인",
        unnamedPost: "제목 없는 게시물",
        noTimeline: "표시할 이벤트 타임라인 데이터가 없습니다.",
        noHighlights: "사용 가능한 핵심 요점이 없습니다.",
        noExpanded: "사용 가능한 상세 정리가 없습니다.",
        noImage: "이 게시물에는 사용할 수 있는 이미지가 없습니다. 아래 정리를 확인하세요.",
        clickForDetail: "전체 AI 정리, 원문 링크, 이미지를 보려면 여세요.",
        alphaSlots: "Alpha 4분할 정리",
        eventSlots: "이벤트 4분할 정리",
        marketSlots: "시장 4분할 정리",
        reportSlots: "도구 / 가이드 4분할 정리",
        generalSlots: "4분할 정리",
        whenOnline: "시점",
        whatChanged: "변경 내용",
        affected: "영향 대상",
        nextFirst: "먼저 할 일",
        whenJoin: "참여 시점",
        whereJoin: "참여 장소",
        rewardGet: "보상",
        coreEvent: "핵심 사건",
        keyNumber: "핵심 수치",
        impact: "영향",
        compareWhat: "비교 대상",
        keyDiff: "주요 차이",
        audienceFit: "적합 대상",
        coreTopic: "핵심 주제",
        contextNow: "현재 맥락",
        yourImpact: "나에게 미치는 영향",
        nextStep: "다음 단계",
        reward: "보상",
        participation: "참여 방법",
        audience: "대상",
        location: "장소",
        schedule: "시간",
        tbdOfficial: "공식 보충 대기",
        basisFromSource: "원문 공지를 기준으로 확인",
        seeSourceTime: "시간은 원문에서 확인",
        seeSourcePrice: "가격, 거래, 시장 규모 정보는 원문에서 확인",
        marketUpdate: "시장 업데이트",
        marketImpact: "단기 시장 방향에 대한 커뮤니티 판단에 영향을 줄 수 있습니다",
        compareSourcesFirst: "결정 전에 여러 출처를 비교하세요",
        comparePlanDiff: "여러 선택지의 차이를 비교하는 내용",
        planAudience: "빠르게 선택해야 하는 사람에게 적합",
        budgetTrial: "예산과 일정에 맞춰 하나를 먼저 테스트하세요",
        contentPending: "내용 보충 대기",
        recentUpdate: "최근 업데이트",
        communityTrackingBasis: "커뮤니티 관찰과 후속 추적 자료로 활용",
        followSameAccount: "원문을 보고 같은 계정의 후속 글을 추적하세요",
        alphaCheckConditions: "오픈 조건과 시간을 먼저 확인하세요",
        officialPending: "공식 발표 대기",
        updatePending: "업데이트 세부 내용 확인 필요",
        audiencePending: "영향 대상 공식 확인 필요",
        liveReleased: "출시됨",
        sbtAcquisition: "SBT 획득 방법",
        sbtAcquisitionNext: "다음: 상세 -> 게시 / 이벤트",
        sbtAcquisitionEmpty: "명확한 SBT 획득 방법이 아직 정리되지 않았습니다.",
        sbtStatusPending: "확인 필요",
        sbtStatusClaimable: "수령 가능",
        sbtStatusExpired: "만료됨",
        sbtJumpToCard: "카드로 이동",
        snapshotAction: "스냅샷 전까지 점수를 올리고, 이후 공식 최종 기준과 SBT 등급을 확인하세요.",
        detailFallbackLead: "사용 가능한 요약이 없습니다. 원문을 확인하세요.",
        eventBackground: "배경",
        timeLocation: "시간 / 장소",
        rewardIncentive: "보상 / 유인",
        joinMethod: "참여 방법",
        possibleImpact: "가능한 영향",
        sourceRulesFirst: "참여 전 원문에서 규칙, 시간, 제한을 확인하세요.",
        pokemonNews: "포켓몬 최신 소식",
        keySummary: "핵심 요약",
        fullSummary: "전체 정리",
        noPokemonNews: "표시할 최신 소식이 없습니다.",
        noPokemonPoints: "표시할 핵심 요점이 없습니다.",
        clickCardFull: "카드를 열어 전체 정리를 확인하세요.",
        aiOrganized: "AI 정리",
        basicOrganized: "기본 정리",
        source: "출처",
        language: "언어",
        updated: "업데이트",
        cached: "캐시",
        realtime: "실시간",
        backgroundUpdating: "백그라운드 업데이트 중",
        nextRefresh: "다음",
        loadingNews: "출처: MiniMax NewsAgent · 로딩 중...",
        updatingNews: "출처: MiniMax NewsAgent · 최신 소식 업데이트 중...",
        repairingLoadState: "로딩 상태를 복구하는 중...",
        repairDoneReloading: "로딩 상태를 정리했습니다. 데이터를 다시 가져오는 중...",
        repairFailed: "복구 실패",
        feedFailedUsingSnapshot: "API에 일시적으로 연결할 수 없어 마지막 성공 데이터를 사용합니다.",
        feedAutoRepaired: "손상된 로딩 상태를 감지해 자동 복구하고 데이터를 다시 가져왔습니다.",
      },
    };

    const TAG_LABEL_TRANSLATIONS = {
      "活動": "event",
      "參與": "participation",
      "市场": "market",
      "市場": "market",
      "收藏": "collectibles",
      "收藏趨勢": "collectibles",
      "收藏趋势": "collectibles",
      "趨勢": "trend",
      "趋势": "trend",
      "數據": "keyNumber",
      "数据": "keyNumber",
      "功能": "feature",
      "即將開放": "alpha",
      "即将开放": "alpha",
      "觀點": "insight",
      "观点": "insight",
      "公告": "announcement",
      "報告": "report",
      "报告": "report",
      "寶可夢": "pokemon",
      "宝可梦": "pokemon",
      "工具": "guides",
      "攻略": "guides",
      "官方": "official",
    };

    function uiLabel(key) {
      const tag = normalizeUiLang(currentUiLang);
      return UI_LABELS[tag]?.[key] || UI_LABELS["zh-Hant"]?.[key] || String(key || "");
    }

    function translateDisplayLabel(raw) {
      const text = String(raw || "").trim();
      if (!text) return "";
      const mapped = TAG_LABEL_TRANSLATIONS[text];
      if (mapped) return uiLabel(mapped);
      return text;
    }

    function intelTypeLabel(type) {
      const raw = String(type || "").trim();
      return uiLabel(raw) || intelTypeLabelMap[raw] || uiLabel("intelligence");
    }

    function truncateText(text, limit = 92) {
      const safe = String(text || "").replace(/\s+/g, " ").trim();
      if (!safe) return "";
      if (safe.length <= limit) return safe;
      return `${safe.slice(0, Math.max(20, limit - 1)).trim()}…`;
    }

    function cardStableKey(card, fallback = "") {
      const id = String(card?.id || "").trim();
      if (id) return id;
      const url = String(card?.url || "").trim();
      if (url) return url;
      const account = String(card?.account || "source").trim();
      const published = String(card?.published_at || "").trim();
      const tail = String(fallback || "").trim();
      return `${account}-${published}-${tail}`;
    }

    const eventFactOrder = ["reward", "participation", "audience", "location", "schedule"];
    const eventFactLabels = {
      reward: "reward",
      participation: "participation",
      audience: "audience",
      location: "location",
      schedule: "schedule",
    };

    function collectEventFactRows(item) {
      if (String(item?.card_type || "") !== "event") return [];
      const rows = [];
      const seen = new Set();
      const pushRow = (key, raw) => {
        const label = uiLabel(eventFactLabels[key]);
        const value = String(raw || "").replace(/\s+/g, " ").trim();
        if (!label || !value) return;
        const sig = `${key}:${value.toLowerCase()}`;
        if (seen.has(sig)) return;
        seen.add(sig);
        rows.push({ label, value });
      };

      const facts = (item && typeof item.event_facts === "object" && item.event_facts) ? item.event_facts : {};
      eventFactOrder.forEach((key) => pushRow(key, facts?.[key]));

      if (!rows.length) {
        const bullets = Array.isArray(item?.bullets) ? item.bullets : [];
        bullets.forEach((raw) => {
          const text = String(raw || "").replace(/\s+/g, " ").trim();
          if (!text) return;
          if (/^獎勵|reward|prize|sbt|airdrop/i.test(text)) pushRow("reward", text.replace(/^([^：:]+)[：:]\s*/u, ""));
          else if (/^參與|報名|register|join|填表|投票/i.test(text)) pushRow("participation", text.replace(/^([^：:]+)[：:]\s*/u, ""));
          else if (/^對象|客群|適合|觀眾|玩家|community/i.test(text)) pushRow("audience", text.replace(/^([^：:]+)[：:]\s*/u, ""));
          else if (/^地點|場域|venue|discord|space|hong kong|香港/i.test(text)) pushRow("location", text.replace(/^([^：:]+)[：:]\s*/u, ""));
          else if (/^時間|time|date|4月|[0-1]?\d\/[0-3]?\d/i.test(text)) pushRow("schedule", text.replace(/^([^：:]+)[：:]\s*/u, ""));
        });
      }

      return rows.slice(0, 4);
    }

    function renderEventFactsHtml(item) {
      const rows = collectEventFactRows(item);
      if (!rows.length) return "";
      return `<div class="intel-event-facts">${rows.map((x) => `<div class="intel-event-fact"><span class="intel-event-fact-label">${escapeHtml(x.label)}</span><span class="intel-event-fact-value">${escapeHtml(x.value)}</span></div>`).join("")}</div>`;
    }

    function normalizeKeylineText(raw) {
      const text = String(raw || "").replace(/\s+/g, " ").trim();
      if (!text) return "";
      return text
        .replace(/^(核心重點|內容摘要|提及數字|補充內容|補充觀察|追蹤方向|更新主題|目前進度|下一步|判讀方式|活動主題|建議動作|核心訊號|關鍵數字|決策建議|判讀建議|分析主題|文中數據|使用方式)[:：]\s*/u, "")
        .trim();
    }

    function cardPrimaryHighlight(item) {
      const factRows = collectEventFactRows(item);
      if (factRows.length) {
        const first = factRows[0];
        return truncateText(`${first.label}: ${first.value}`, 84);
      }
      const glance = cleanMasterSummary(item?.glance || "");
      if (glance) return truncateText(glance, 90);
      const bullets = Array.isArray(item?.bullets) ? item.bullets : [];
      const firstBullet = bullets.find((x) => normalizeKeylineText(x));
      if (firstBullet) return truncateText(normalizeKeylineText(firstBullet), 92);
      const summary = cleanMasterSummary(item?.summary || "");
      if (summary) return truncateText(summary, 92);
      return uiLabel("clickForDetail");
    }

    function toTimelineInputDate(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const exact = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (exact) return exact[1];
      const dt = new Date(raw);
      if (Number.isNaN(dt.valueOf())) return "";
      return dt.toISOString().slice(0, 10);
    }

    function timelineRangeText(startValue, endValue) {
      const start = toTimelineInputDate(startValue);
      const end = toTimelineInputDate(endValue);
      if (start && end && start !== end) {
        return `${toPosterDate(start)} ~ ${toPosterDate(end)}`;
      }
      if (end) return toPosterDate(end);
      if (start) return toPosterDate(start);
      return "";
    }

    function buildTimelineEditControls(id, startValue, endValue) {
      if (!id || !intelCanEdit()) return "";
      const startDate = toTimelineInputDate(startValue);
      const endDate = toTimelineInputDate(endValue);
      return `<div class="intel-timeline-edit" data-intel-timeline-editor>
          <label class="intel-timeline-field">Start
            <input type="date" data-intel-timeline-start value="${escapeHtml(startDate)}" />
          </label>
          <label class="intel-timeline-field">End
            <input type="date" data-intel-timeline-end value="${escapeHtml(endDate)}" />
          </label>
          <button class="intel-pick-btn" data-intel-action="timeline-save" data-intel-id="${escapeHtml(id)}">更新日期</button>
        </div>`;
    }

    function renderMasterTimelineCard(item, index, total, options = {}) {
      const preview = Boolean(options?.preview);
      const dt = resolveMasterTimelineDate(item);
      const bucket = currentTimelineBucket(dt);
      const eventText = timelineRangeText(item?.timeline_date, item?.timeline_end_date) || (dt ? toPosterDate(dt.toISOString()) : "--");
      const publishText = toLocalTime(item?.published_at);
      const cover = resolveCoverImageUrl(item?.cover_image);
      const coverAttrs = coverImageAttrs(cover);
      const backdropStyle = cover
        ? `background-image: url('${escapeHtml(cover)}');`
        : "background-image: linear-gradient(140deg, #1f3551, #2b4e73 46%, #29495b 100%);";
      const coverHtml = cover
        ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(item?.title || "timeline cover")}" ${coverAttrs} onerror="if(this.dataset.fallbackApplied==='1'){this.remove();return;}this.dataset.fallbackApplied='1';this.src='${escapeHtml(DEFAULT_COVER_IMAGE)}';" />`
        : "";
      const id = String(item?.id || "");
      const picked = Boolean(item?.manual_pick);
      const pinned = Boolean(item?.manual_pin);
      const bottomed = Boolean(item?.manual_bottom);
      const eventWall = item?.event_wall === true;
      const feedbackLabel = String(item?.card_type || "insight");
      const actionHtml = (!preview && id && intelCanEdit())
        ? `<div class="intel-actions">
            <button class="intel-pick-btn ${picked ? "is-picked" : ""}" data-intel-action="include" data-intel-id="${escapeHtml(id)}">${escapeHtml(picked ? uiLabel("kept") : uiLabel("keep"))}</button>
            <button class="intel-pick-btn ${pinned ? "is-picked" : ""}" data-intel-action="${pinned ? "unpin" : "pin"}" data-intel-id="${escapeHtml(id)}">${escapeHtml(pinned ? uiLabel("pinned") : uiLabel("pin"))}</button>
            <button class="intel-pick-btn ${bottomed ? "is-picked" : ""}" data-intel-action="${bottomed ? "unbottom" : "bottom"}" data-intel-id="${escapeHtml(id)}">${escapeHtml(bottomed ? uiLabel("bottomed") : uiLabel("bottom"))}</button>
            <button class="intel-pick-btn ${eventWall ? "is-picked" : ""}" data-intel-action="eventwall-false" data-intel-id="${escapeHtml(id)}">移出活動牆</button>
            <button class="intel-pick-btn" data-intel-action="refresh-content" data-intel-id="${escapeHtml(id)}">重新整理內容</button>
            <button class="intel-pick-btn" data-intel-action="exclude" data-intel-id="${escapeHtml(id)}">${escapeHtml(uiLabel("exclude"))}</button>
            <button class="intel-pick-btn" data-intel-action="feedback" data-intel-id="${escapeHtml(id)}" data-intel-label="${escapeHtml(feedbackLabel)}">${escapeHtml(uiLabel("feedback"))}</button>
          </div>`
        : "";
      const timelineEditorHtml = buildTimelineEditControls(id, item?.timeline_date, item?.timeline_end_date);
      const keyline = cardPrimaryHighlight(item);
      const cleanTitle = cleanMasterTitle(item?.title || uiLabel("unnamedTimeline"));
      const toggleHtml = (!preview && id)
        ? `<button class="intel-master-toggle" type="button" data-intel-open-detail="${escapeHtml(id)}">${escapeHtml(uiLabel("detail"))}</button>`
        : "";

      return `
        <article class="intel-master-card ${preview ? "is-preview" : ""}" style="${backdropStyle}">
          <div class="intel-master-head">
            <span class="intel-master-kicker">@${escapeHtml(item?.account || "source")} · ${escapeHtml(categoryLabel(item?.card_type))} · ${escapeHtml(bucket)}</span>
            <span class="intel-master-when">${escapeHtml(uiLabel("published"))} ${escapeHtml(publishText)} · ${escapeHtml(uiLabel("eventDate"))} ${escapeHtml(eventText)}</span>
          </div>
          <div class="intel-master-media">${coverHtml}</div>
          <div class="intel-master-title-row">
            <h4 class="intel-master-title">${escapeHtml(cleanTitle || uiLabel("unnamedTimeline"))}</h4>
            ${toggleHtml}
          </div>
          ${keyline ? `<p class="intel-master-summary">${escapeHtml(keyline)}</p>` : ""}
          <div class="intel-master-footer">
            <span class="intel-master-index">${index + 1} / ${total}</span>
            ${actionHtml}
            ${timelineEditorHtml}
            <a class="intel-source-link" href="${escapeHtml(item?.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(uiLabel("sourceOriginal"))}</a>
          </div>
          ${item?.url ? `<a class="intel-source-raw" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a>` : ""}
        </article>
      `;
    }

    function renderMasterTimelineView() {
      const stage = document.getElementById("intel-master-stage");
      const rail = document.getElementById("intel-master-rail");
      const todayTag = document.getElementById("intel-master-today-date");
      if (!stage || !rail) return;
      if (todayTag) todayTag.textContent = todayLabelText();

      const items = intelMasterTimelineState.items || [];
      if (!items.length) {
        stage.classList.remove("is-dragging", "is-animating", "dir-next", "dir-prev");
        stage.style.removeProperty("--intel-master-drag");
        rail.innerHTML = "";
        stage.innerHTML = `<p class="intel-masterline-empty">${escapeHtml(uiLabel("noTimeline"))}</p>`;
        return;
      }

      const len = items.length;
      const idx = clampMasterIndex(intelMasterTimelineState.index, len);
      intelMasterTimelineState.index = idx;
      const prevIdx = clampMasterIndex(idx - 1, len);
      const nextIdx = clampMasterIndex(idx + 1, len);
      const single = len <= 1;
      const active = items[idx];
      const prev = items[prevIdx];
      const next = items[nextIdx];
      stage.classList.remove("is-dragging", "is-animating", "dir-next", "dir-prev");
      stage.style.removeProperty("--intel-master-drag");

      if (single) {
        stage.innerHTML = `
          <div class="intel-master-track is-single">
            <section class="intel-master-slide is-active">
              ${renderMasterTimelineCard(active, idx, len)}
            </section>
          </div>
        `;
      } else {
        stage.innerHTML = `
          <div class="intel-master-track">
            <section class="intel-master-slide is-prev is-preview" data-master-jump="${prevIdx}">
              ${renderMasterTimelineCard(prev, prevIdx, len, { preview: true })}
            </section>
            <section class="intel-master-slide is-active">
              ${renderMasterTimelineCard(active, idx, len)}
            </section>
            <section class="intel-master-slide is-next is-preview" data-master-jump="${nextIdx}">
              ${renderMasterTimelineCard(next, nextIdx, len, { preview: true })}
            </section>
          </div>
        `;
      }

      rail.innerHTML = items.map((it, i) => {
        const dt = resolveMasterTimelineDate(it);
        const label = dt ? toPosterDate(dt.toISOString()) : "--";
        const topic = timelineTopic(it);
        const today = isTodayTimelineDate(dt) ? `<span class="intel-masterline-today">今日</span>` : "";
        const classes = [
          "intel-masterline-chip",
          i === idx ? "is-active" : "",
          isOfficialTimelineEvent(it) ? "is-official-event" : "",
        ].filter(Boolean).join(" ");
        return `<button class="${classes}" data-master-index="${i}" type="button"><span class="intel-masterline-date-row"><span class="intel-masterline-date">${escapeHtml(label)}</span>${today}</span><span class="intel-masterline-topic">${escapeHtml(topic)}</span></button>`;
      }).join("");
      const activeChip = rail.querySelector(".intel-masterline-chip.is-active");
      if (activeChip && typeof rail.scrollTo === "function") {
        const targetLeft = Math.max(
          0,
          activeChip.offsetLeft - ((rail.clientWidth - activeChip.offsetWidth) / 2)
        );
        rail.scrollTo({ left: targetLeft, behavior: "smooth" });
      }
    }

    function renderMasterTimeline(payload) {
      const cards = Array.isArray(payload?.cards) ? payload.cards : [];
      const nextItems = buildMasterTimelineItems(cards);
      const currentId = (intelMasterTimelineState.items || [])[intelMasterTimelineState.index]?.id;
      intelMasterTimelineState.items = nextItems;

      if (!nextItems.length) {
        intelMasterTimelineState.index = 0;
      } else {
        const keepIdx = currentId ? nextItems.findIndex((x) => String(x?.id || "") === String(currentId)) : -1;
        intelMasterTimelineState.index = keepIdx >= 0 ? keepIdx : pickInitialMasterIndex(nextItems);
      }
      renderMasterTimelineView();
    }

    function animateMasterTimeline(step) {
      const items = intelMasterTimelineState.items || [];
      if (!items.length || items.length < 2 || !step) return;
      if (intelMasterTimelineState.animating) return;
      const stage = document.getElementById("intel-master-stage");
      if (!stage) return;
      const nextIndex = clampMasterIndex(intelMasterTimelineState.index + step, items.length);
      if (nextIndex === intelMasterTimelineState.index) return;
      intelMasterTimelineState.animating = true;
      stage.classList.remove("dir-next", "dir-prev", "is-dragging");
      stage.style.removeProperty("--intel-master-drag");
      stage.classList.add("is-animating", step > 0 ? "dir-next" : "dir-prev");
      window.setTimeout(() => {
        intelMasterTimelineState.index = nextIndex;
        intelMasterTimelineState.animating = false;
        renderMasterTimelineView();
      }, 380);
    }

    function moveMasterTimeline(step) {
      animateMasterTimeline(Number(step) || 0);
    }

    function clearFlingTail() {
      if (!intelMasterTimelineState.flingTailTimer) return;
      window.clearTimeout(intelMasterTimelineState.flingTailTimer);
      intelMasterTimelineState.flingTailTimer = null;
    }

    function jumpMasterTimeline(index) {
      const items = intelMasterTimelineState.items || [];
      const len = items.length;
      if (!len) return;
      const idx = Number(index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= len) return;
      intelMasterTimelineState.index = idx;
      renderMasterTimelineView();
    }

    function intelCardHtml(card) {
      const layout = ["poster", "brief", "data", "timeline"].includes(card.layout) ? card.layout : "brief";
      const typeLabel = intelTypeLabel(card.card_type);
      const cardKey = String(card?._card_key || cardStableKey(card)).trim();
      const cover = resolveCoverImageUrl(card.cover_image);
      const coverAttrs = coverImageAttrs(cover);
      const coverHtml = cover
        ? `<div class="intel-cover"><img src="${escapeHtml(cover)}" alt="${escapeHtml(card.title || "intel cover")}" ${coverAttrs} onerror="if(this.dataset.fallbackApplied==='1'){this.closest('.intel-cover')?.remove();return;}this.dataset.fallbackApplied='1';this.src='${escapeHtml(DEFAULT_COVER_IMAGE)}';" /></div>`
        : "";
      const tags = Array.isArray(card.tags) ? card.tags.slice(0, 3) : [];
      const tagHtml = tags
        .map((tag) => `<span class=\"intel-tag\">${escapeHtml(translateDisplayLabel(tag))}</span>`)
        .join("");
      const timelineText = timelineRangeText(card.timeline_date, card.timeline_end_date);
      const timeText = `${uiLabel("published")} ${toLocalTime(card.published_at)}${timelineText && timelineText !== "--" ? ` · ${uiLabel("eventDate")} ${timelineText}` : ""}`;
      const canPick = String(card.id || "").trim() !== "";
      const picked = Boolean(card.manual_pick);
      const pinned = Boolean(card.manual_pin);
      const bottomed = Boolean(card.manual_bottom);
      const eventWall = card?.event_wall === true;
      const actionHtml = (canPick && intelCanEdit())
        ? `<div class="intel-actions">
             <button class="intel-pick-btn ${picked ? "is-picked" : ""}" data-intel-action="include" data-intel-id="${escapeHtml(card.id)}">${escapeHtml(picked ? uiLabel("kept") : uiLabel("keep"))}</button>
             <button class="intel-pick-btn ${pinned ? "is-picked" : ""}" data-intel-action="${pinned ? "unpin" : "pin"}" data-intel-id="${escapeHtml(card.id)}">${escapeHtml(pinned ? uiLabel("pinned") : uiLabel("pin"))}</button>
             <button class="intel-pick-btn ${bottomed ? "is-picked" : ""}" data-intel-action="${bottomed ? "unbottom" : "bottom"}" data-intel-id="${escapeHtml(card.id)}">${escapeHtml(bottomed ? uiLabel("bottomed") : uiLabel("bottom"))}</button>
             <button class="intel-pick-btn ${eventWall ? "is-picked" : ""}" data-intel-action="eventwall-true" data-intel-id="${escapeHtml(card.id)}">${escapeHtml(eventWall ? "已在活動牆" : "加入活動牆")}</button>
             <button class="intel-pick-btn" data-intel-action="refresh-content" data-intel-id="${escapeHtml(card.id)}">重新整理內容</button>
             <button class="intel-pick-btn" data-intel-action="exclude" data-intel-id="${escapeHtml(card.id)}">${escapeHtml(uiLabel("exclude"))}</button>
             <button class="intel-pick-btn" data-intel-action="feedback" data-intel-id="${escapeHtml(card.id)}" data-intel-label="${escapeHtml(String(card.card_type || "insight"))}">${escapeHtml(uiLabel("feedback"))}</button>
           </div>`
        : "";
      const timelineEditorHtml = buildTimelineEditControls(card.id, card.timeline_date, card.timeline_end_date);
      const keylineText = cardPrimaryHighlight(card);
      const keylineLabel = keylineText ? `<div class="intel-detail-block-title">${escapeHtml(uiLabel("oneLine"))}</div>` : "";

      if (layout === "poster") {
        return `
          <article class="intel-card layout-poster" data-intel-card-id="${escapeHtml(cardKey)}">
            <div class="intel-poster-top">
              <span class="intel-kicker">@${escapeHtml(card.account)} · ${escapeHtml(typeLabel)}</span>
              <span class="intel-poster-date">${escapeHtml(toPosterDate(card.published_at))}</span>
            </div>
            <div class="intel-poster-glow"></div>
            ${coverHtml}
            <h4 class="intel-title">${escapeHtml(card.title || "@source event")}</h4>
            ${keylineLabel}
            ${keylineText ? `<p class="intel-keyline">${escapeHtml(keylineText)}</p>` : ""}
            <div class="intel-footer">
              <div class="intel-tags">${tagHtml}</div>
              <span class="intel-time">${escapeHtml(timeText)}</span>
              ${actionHtml}
              ${timelineEditorHtml}
              <a class="intel-source-link" href="${escapeHtml(card.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(uiLabel("sourceOriginal"))}</a>
            </div>
            ${card.url ? `<a class="intel-source-raw" href="${escapeHtml(card.url)}" target="_blank" rel="noreferrer">${escapeHtml(card.url)}</a>` : ""}
          </article>
        `;
      }

      return `
        <article class="intel-card layout-${layout}" data-intel-card-id="${escapeHtml(cardKey)}">
          <span class="intel-kicker">@${escapeHtml(card.account)} · ${escapeHtml(typeLabel)}</span>
          <h4 class="intel-title">${escapeHtml(card.title || "@source update")}</h4>
          ${keylineLabel}
          ${keylineText ? `<p class="intel-keyline">${escapeHtml(keylineText)}</p>` : ""}
          ${coverHtml}
          <div class="intel-footer">
            <div class="intel-tags">${tagHtml}</div>
            <span class="intel-time">${escapeHtml(timeText)}</span>
            ${actionHtml}
            ${timelineEditorHtml}
            <a class="intel-source-link" href="${escapeHtml(card.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(uiLabel("sourceOriginal"))}</a>
          </div>
          ${card.url ? `<a class="intel-source-raw" href="${escapeHtml(card.url)}" target="_blank" rel="noreferrer">${escapeHtml(card.url)}</a>` : ""}
        </article>
      `;
    }

    function setIntelMessage(text, mode = "") {
      const el = document.getElementById("intel-action-message");
      if (!el) return;
      el.classList.remove("is-error", "is-ok");
      if (mode === "error") el.classList.add("is-error");
      if (mode === "ok") el.classList.add("is-ok");
      el.removeAttribute("data-i18n-key");
      el.textContent = text;
    }

    function renderSectionList(el, items, emptyText = "目前無重點") {
      if (!el) return;
      el.innerHTML = "";
      const rows = Array.isArray(items) ? items : [];
      if (!rows.length) {
        const li = document.createElement("li");
        li.textContent = emptyText;
        el.appendChild(li);
        return;
      }
      rows.slice(0, 5).forEach((item) => {
        const li = document.createElement("li");
        li.className = "intel-section-item";
        const headline = String(item?.headline || item?.point || "未命名重點");
        const url = String(item?.url || "");
        const account = String(item?.account || "");
        const engagement = String(item?.engagement || "");
        if (url.startsWith("http")) {
          li.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(headline)}</a>（@${escapeHtml(account)} ${escapeHtml(engagement)}）`;
        } else {
          li.textContent = `${headline}（@${account} ${engagement}）`;
        }
        el.appendChild(li);
      });
    }

    function renderAgendaList(el, items, emptyText = "目前無重點") {
      if (!el) return;
      el.innerHTML = "";
      const rows = Array.isArray(items) ? items : [];
      if (!rows.length) {
        const li = document.createElement("li");
        li.className = "source-empty";
        li.textContent = emptyText;
        el.appendChild(li);
        return;
      }
      rows.slice(0, 6).forEach((item) => {
        const li = document.createElement("li");
        li.className = "intel-agenda-item";
        const label = String(item?.label || "--");
        const urgency = String(item?.urgency || "normal").toLowerCase();
        const headline = String(item?.headline || item?.glance || "未命名重點");
        const point = String(item?.glance || "");
        const account = String(item?.account || "");
        const url = String(item?.url || "");
        const daysLeft = Number.isFinite(Number(item?.days_left)) ? Number(item.days_left) : null;
        const dueText = daysLeft === null ? "" : (daysLeft >= 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`);

        const top = document.createElement("div");
        top.className = "intel-agenda-top";
        const labelNode = document.createElement("span");
        labelNode.className = `intel-agenda-label ${urgency === "high" ? "is-high" : urgency === "medium" ? "is-medium" : ""}`.trim();
        labelNode.textContent = dueText ? `${label} · ${dueText}` : label;
        top.appendChild(labelNode);
        li.appendChild(top);

        if (url.startsWith("http")) {
          const a = document.createElement("a");
          a.className = "intel-agenda-headline";
          a.href = url;
          a.target = "_blank";
          a.rel = "noreferrer";
          a.textContent = headline;
          li.appendChild(a);
        } else {
          const div = document.createElement("div");
          div.className = "intel-agenda-headline";
          div.textContent = headline;
          li.appendChild(div);
        }

        if (point) {
          const p = document.createElement("div");
          p.className = "intel-agenda-point";
          p.textContent = point;
          li.appendChild(p);
        }

        const meta = document.createElement("div");
        meta.className = "intel-agenda-meta";
        meta.textContent = `@${account} · ${toLocalTime(item?.published_at)}`;
        li.appendChild(meta);
        el.appendChild(li);
      });
    }

    function toTimestamp(value) {
      const dt = value ? new Date(value) : null;
      if (!dt || Number.isNaN(dt.valueOf())) return 0;
      return dt.valueOf();
    }

    function sortCardsByTimeDesc(rows) {
      return [...rows].sort((a, b) => {
        const aPinned = Boolean(a?.manual_pin);
        const bPinned = Boolean(b?.manual_pin);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        const aBottom = Boolean(a?.manual_bottom);
        const bBottom = Boolean(b?.manual_bottom);
        if (aBottom !== bBottom) return aBottom ? 1 : -1;
        const diff = toTimestamp(b?.published_at) - toTimestamp(a?.published_at);
        if (diff !== 0) return diff;
        return String(b?.id || "").localeCompare(String(a?.id || ""));
      });
    }

    function cardTextBlob(card) {
      const parts = [];
      parts.push(String(card?.title || ""));
      parts.push(String(card?.summary || ""));
      parts.push(String(card?.glance || ""));
      parts.push(String(card?.raw_text || ""));
      if (Array.isArray(card?.bullets)) parts.push(card.bullets.join(" "));
      if (Array.isArray(card?.tags)) parts.push(card.tags.join(" "));
      if (card?.event_facts && typeof card.event_facts === "object") {
        parts.push(Object.values(card.event_facts).map((x) => String(x || "")).join(" "));
      }
      return parts.join(" ").toLowerCase();
    }

    const TOPIC_LABELS = ["events", "official", "sbt", "pokemon", "collectibles", "alpha", "guides", "community", "other"];
    const TOPIC_LABEL_ALIASES = {
      tool: "guides",
      tools: "guides",
      guide: "guides",
      community_picks: "community",
      "community-picks": "community",
      none: "other",
      unclassified: "other",
      uncategorized: "other",
      "5": "other",
    };

    function normalizeTopicLabels(value) {
      const raw = Array.isArray(value)
        ? value
        : (typeof value === "string" ? value.split(/[,\u3001/|\\\s]+/g) : []);
      const out = [];
      raw.forEach((item) => {
        const rawLabel = String(item || "").trim().toLowerCase();
        const label = TOPIC_LABEL_ALIASES[rawLabel] || rawLabel;
        if (!label || !TOPIC_LABELS.includes(label) || out.includes(label)) return;
        out.push(label);
      });
      return out;
    }

    function cardTopicLabels(card) {
      const labels = normalizeTopicLabels(card?.topic_labels);
      return labels.length ? labels : ["other"];
    }

    function dateOnlyUtc(value) {
      const raw = String(value || "").trim();
      if (!raw) return null;
      const dt = new Date(raw);
      if (Number.isNaN(dt.valueOf())) return null;
      return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    }

    function resolveCardWindowRange(item) {
      const cardType = String(item?.card_type || "").trim().toLowerCase();
      if (cardType === "event" || cardType === "feature" || cardType === "announcement") {
        const start = dateOnlyUtc(item?.timeline_date);
        const end = dateOnlyUtc(item?.timeline_end_date);
        if (start || end) {
          const safeStart = start || end;
          const safeEnd = end || start;
          return safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart];
        }
        const dt = resolveMasterTimelineDate(item);
        if (dt instanceof Date && !Number.isNaN(dt.valueOf())) return [dt, dt];
      }
      const published = dateOnlyUtc(item?.published_at);
      return published ? [published, published] : [null, null];
    }

    function resolveCardWindowDate(item) {
      const [start, end] = resolveCardWindowRange(item);
      return end || start || null;
    }

    function isWithinBiweekWindow(item) {
      const [start, end] = resolveCardWindowRange(item);
      if (!(start instanceof Date) || Number.isNaN(start.valueOf())) return false;
      if (!(end instanceof Date) || Number.isNaN(end.valueOf())) return false;
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      const windowStart = new Date(base);
      windowStart.setDate(windowStart.getDate() - 14);
      const windowEnd = new Date(base);
      windowEnd.setDate(windowEnd.getDate() + 14);
      return start <= windowEnd && end >= windowStart;
    }

    function routeIntelCards(cards) {
      const buckets = {
        events: [],
        official: [],
        sbt: [],
        pokemon: [],
        collectibles: [],
        alpha: [],
        guides: [],
        community: [],
        other: [],
      };
      const seenByBucket = {
        events: new Set(),
        official: new Set(),
        sbt: new Set(),
        pokemon: new Set(),
        collectibles: new Set(),
        alpha: new Set(),
        guides: new Set(),
        community: new Set(),
        other: new Set(),
      };
      (Array.isArray(cards) ? cards : []).forEach((card) => {
        const labels = cardTopicLabels(card);
        const key = cardStableKey(card);
        const normalized = { ...card, route_labels: labels, _card_key: key };
        const keepByWindow = Boolean(normalized.manual_pin) || isWithinBiweekWindow(normalized);
        if (normalized.event_wall === true && keepByWindow) {
          const eventSeen = seenByBucket.events;
          if (!eventSeen.has(key)) {
            eventSeen.add(key);
            buckets.events.push(normalized);
          }
        }
        labels.forEach((label) => {
          const bucket = buckets[label] ? label : "other";
          if (bucket === "events") return;
          if (bucket !== "collectibles" && !keepByWindow) return;
          const seen = seenByBucket[bucket];
          if (seen.has(key)) return;
          seen.add(key);
          buckets[bucket].push(normalized);
        });
      });
      Object.keys(buckets).forEach((key) => {
        buckets[key] = sortCardsByTimeDesc(buckets[key]);
      });
      return buckets;
    }

    function cardsToSectionItems(cards) {
      return (Array.isArray(cards) ? cards : []).slice(0, 8).map((card) => ({
        headline: cleanMasterTitle(String(card?.title || card?.glance || "未命名貼文")),
        point: String(card?.glance || card?.summary || ""),
        account: String(card?.account || ""),
        url: String(card?.url || ""),
        engagement: `· ${toLocalTime(card?.published_at)}`,
      }));
    }

    function intelCardGridSignature(rows, emptyText, canEdit) {
      try {
        const core = (Array.isArray(rows) ? rows : []).map((card, idx) => [
          card?._card_key || cardStableKey(card, idx),
          card?.id,
          card?.title,
          card?.glance,
          card?.summary,
          card?.card_type,
          card?.layout,
          card?.account,
          card?.published_at,
          card?.cover_image,
          card?.timeline_date,
          card?.timeline_end_date,
          card?.event_wall,
          card?.manual_pick,
          card?.manual_pin,
          card?.manual_bottom,
          card?.dedupe_status,
          Array.isArray(card?.tags) ? card.tags.join("|") : "",
          Array.isArray(card?.topic_labels) ? card.topic_labels.join("|") : "",
          Array.isArray(card?.sbt_names) ? card.sbt_names.join("|") : "",
          card?.sbt_name,
          card?.sbt_acquisition,
        ]);
        return JSON.stringify([Boolean(canEdit), String(emptyText || ""), core]);
      } catch (_error) {
        return `${Date.now()}`;
      }
    }

    function keepRenderedImagesWarm(wrap) {
      if (!wrap || !wrap.querySelectorAll) return;
      wrap.querySelectorAll("img[loading='lazy']").forEach((img) => {
        img.loading = "eager";
        img.decoding = "async";
      });
    }

    function renderCardGrid(containerId, emptyId, cards, emptyText) {
      const wrap = document.getElementById(containerId);
      const empty = document.getElementById(emptyId);
      if (!wrap || !empty) return;
      const rows = Array.isArray(cards) ? cards : [];
      const adminOnly = wrap.classList.contains("intel-user-hidden");
      const canShowAdminOnly = !adminOnly || document.body.classList.contains("intel-admin-mode");
      if (!canShowAdminOnly) {
        if (wrap.dataset.renderSig || wrap.innerHTML) {
          wrap.innerHTML = "";
          delete wrap.dataset.renderSig;
        }
        wrap.hidden = true;
        wrap.setAttribute("aria-hidden", "true");
        empty.hidden = true;
        empty.setAttribute("aria-hidden", "true");
        empty.style.display = "none";
        return;
      }
      if (adminOnly) {
        wrap.hidden = false;
        wrap.setAttribute("aria-hidden", "false");
        empty.hidden = Boolean(rows.length);
        empty.setAttribute("aria-hidden", rows.length ? "true" : "false");
      }
      const signature = intelCardGridSignature(rows, emptyText, intelCanEdit());
      if (wrap.dataset.renderSig !== signature) {
        wrap.innerHTML = rows.map((card) => intelCardHtml(card)).join("");
        wrap.dataset.renderSig = signature;
      }
      keepRenderedImagesWarm(wrap);
      empty.textContent = emptyText;
      empty.style.display = rows.length ? "none" : "block";
    }

    function syncIntelCardLookup(routed) {
      intelCardLookup.clear();
      const buckets = routed && typeof routed === "object" ? Object.values(routed) : [];
      buckets.forEach((rows) => {
        (Array.isArray(rows) ? rows : []).forEach((card, idx) => {
          const key = String(card?._card_key || cardStableKey(card, idx)).trim();
          if (!key || intelCardLookup.has(key)) return;
          intelCardLookup.set(key, card);
        });
      });
    }

    function intelApiUrl(path) {
      const tail = String(path || "").trim();
      if (!INTEL_API_BASE) return tail;
      if (!tail) return INTEL_API_BASE;
      if (/^https?:\/\//i.test(tail)) return tail;
      if (tail.startsWith("/")) return `${INTEL_API_BASE}${tail}`;
      return `${INTEL_API_BASE}/${tail}`;
    }

    const DEFAULT_COVER_IMAGE = "./image.webp";

    function coverImageAttrs(src) {
      const isDefault = String(src || "") === DEFAULT_COVER_IMAGE;
      const loading = isDefault ? "eager" : "lazy";
      const priority = isDefault ? " fetchpriority=\"high\"" : "";
      const size = isDefault ? " width=\"1672\" height=\"940\"" : "";
      const cssClass = isDefault ? " class=\"is-default-cover\"" : "";
      return `loading="${loading}" decoding="async"${priority}${size}${cssClass}`;
    }

    function resolveCoverImageUrl(value) {
      const raw = String(value || "").trim();
      if (!raw) return DEFAULT_COVER_IMAGE;
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith("/data/")) return intelApiUrl(raw);
      if (raw.startsWith("data/")) return intelApiUrl(`/${raw}`);
      if (raw.startsWith("/website/")) return raw;
      if (raw.startsWith("website/")) return `/${raw}`;
      if (raw.startsWith("/")) return raw;
      return DEFAULT_COVER_IMAGE;
    }

    const uiTextNodeCache = new WeakMap();
    const uiTranslationMemo = new Map();
    let uiTranslateVersion = 0;
    const uiRowTranslationCache = new Map();
    let uiRowTranslationCacheReady = false;
    let uiRowTranslationCachePromise = null;
    const UI_STATIC_TRANSLATIONS = (window.INTEL_UI_STATIC_TRANSLATIONS && typeof window.INTEL_UI_STATIC_TRANSLATIONS === "object")
      ? window.INTEL_UI_STATIC_TRANSLATIONS
      : {};
    const UI_TRANSLATION_FALLBACKS = (window.INTEL_UI_TRANSLATION_FALLBACKS && typeof window.INTEL_UI_TRANSLATION_FALLBACKS === "object")
      ? window.INTEL_UI_TRANSLATION_FALLBACKS
      : {};

    function normalizeI18nLookupText(raw) {
      return String(raw || "").replace(/\s+/g, " ").trim();
    }

    function lookupUiCachedTranslation(lang, sourceText) {
      const tag = normalizeUiLang(lang);
      if (!tag || tag === "zh-Hant") return "";
      const raw = String(sourceText || "");
      if (!raw) return "";
      const keyRaw = `${tag}\n${raw}`;
      if (uiRowTranslationCache.has(keyRaw)) {
        return String(uiRowTranslationCache.get(keyRaw) || "");
      }
      const normalized = normalizeI18nLookupText(raw);
      if (!normalized) return "";
      const keyNormalized = `${tag}\n${normalized}`;
      if (uiRowTranslationCache.has(keyNormalized)) {
        return String(uiRowTranslationCache.get(keyNormalized) || "");
      }
      return "";
    }

    function rememberUiCachedTranslation(lang, sourceText, translatedText) {
      const tag = normalizeUiLang(lang);
      const raw = String(sourceText || "");
      const translated = String(translatedText || "");
      if (!tag || tag === "zh-Hant" || !raw || !translated || translated === raw) return;
      uiRowTranslationCache.set(`${tag}\n${raw}`, translated);
      const normalized = normalizeI18nLookupText(raw);
      if (normalized && normalized !== raw) {
        uiRowTranslationCache.set(`${tag}\n${normalized}`, translated);
      }
      uiRowTranslationCacheReady = uiRowTranslationCache.size > 0;
    }

    async function ensureUiTranslationCache() {
      uiRowTranslationCacheReady = uiRowTranslationCache.size > 0;
      return uiRowTranslationCachePromise;
    }

    window.ensureUiTranslationCache = ensureUiTranslationCache;
    window.lookupUiCachedTranslation = lookupUiCachedTranslation;
    window.rememberUiCachedTranslation = rememberUiCachedTranslation;

    function shouldTranslateTextNode(node) {
      if (!node || node.nodeType !== Node.TEXT_NODE) return false;
      const parent = node.parentElement;
      if (!parent) return false;
      if (parent.closest("[data-no-i18n='1']")) return false;
      const tag = String(parent.tagName || "").toUpperCase();
      if (["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "OPTION"].includes(tag)) return false;
      const text = String(node.nodeValue || "").replace(/\s+/g, " ").trim();
      if (!text) return false;
      if (text.length < 2) return false;
      if (/^https?:\/\//i.test(text)) return false;
      return true;
    }
