    const sbtIconBase = "https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com/SBT/minified/";

    const sbtRows = [
      {
        name: "Discord Linker / X Linker",
        badge: "✅ Available",
        status: "available",
        requirement: "綁定 Discord、X 帳號。",
        icons: ["13-discord-linker.png", "12-x-linker-new.png"],
      },
      {
        name: "Fund Your Account",
        badge: "✅ Available",
        status: "available",
        requirement: "近 3 天內單筆充值 ≥ 60 USDT。",
        icons: ["14-fund-your-account.png"],
      },
      {
        name: "Pack Opener",
        badge: "✅ Available",
        status: "available",
        requirement: "完成至少 5 次開包。",
        icons: ["2-pack-opener.png"],
      },
      {
        name: "The Trader",
        badge: "✅ Available",
        status: "available",
        requirement: "完成 3 筆以上有效交易。",
        icons: ["1-the-trader.png"],
      },
      {
        name: "The Recruiter",
        badge: "✅ Available",
        status: "available",
        requirement: "成功邀請 5 位以上新用戶。",
        icons: ["3-the-recruiter.png"],
      },
      {
        name: "Community Voice",
        badge: "✅ Available",
        status: "available",
        requirement: "在 X + Discord 持續輸出高品質內容。",
        icons: ["4-community-voice.png"],
      },
      {
        name: "S+ Breaker",
        badge: "✅ Available",
        status: "available",
        requirement: "抽到頂級或 S 級卡。",
        icons: ["22-s-plus-breaker.png"],
      },
      {
        name: "Grand Ripper",
        badge: "✅ Available",
        status: "available",
        requirement: "完成 200 次以上開包。",
        icons: ["34-grand-ripper.png"],
      },
      {
        name: "Signal Booster",
        badge: "✅ Available",
        status: "available",
        requirement: "高質量互動官方與創始人貼文。",
        icons: ["39-signal-booster.png"],
      },
      {
        name: "Community Developer",
        badge: "✅ Available",
        status: "available",
        requirement: "提交並被認可的工具 / App / AI 技術貢獻。",
        icons: ["44-community-dev.png"],
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
        badge: "⭕ Invite",
        status: "invite",
        requirement: "早期高影響力大使 / KOL 類角色。",
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
      const unavailableList = document.getElementById("sbt-unavailable-list");
      const availableCount = document.getElementById("sbt-available-count");
      const unavailableCount = document.getElementById("sbt-unavailable-count");
      if (!availableList || !unavailableList || !availableCount || !unavailableCount) return;

      let availableTotal = 0;
      let unavailableTotal = 0;

      sbtRows.forEach((row) => {
        const item = document.createElement("article");
        item.className = "sbt-item";

        const iconsHtml = row.icons
          .map((file) => {
            const src = `${sbtIconBase}${file}`;
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
              <span class="status ${sbtStatusClass(row.status)}">${row.badge}</span>
            </div>
            <p class="sbt-item-req">${row.requirement}</p>
          </div>
        `;

        if (row.status === "available") {
          availableTotal += 1;
          availableList.appendChild(item);
        } else {
          unavailableTotal += 1;
          unavailableList.appendChild(item);
        }
      });

      availableCount.innerHTML = `<iconify-icon icon="lucide:clock-3"></iconify-icon>${availableTotal} items`;
      unavailableCount.innerHTML = `<iconify-icon icon="lucide:archive-x"></iconify-icon>${unavailableTotal} items`;
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
    const INTEL_API_BASE_STORAGE_KEY = "intel_api_base";
    let intelFeedCache = null;
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
      "events", "official", "sbt", "pokemon", "alpha", "tools", "other",
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
    const INTEL_API_BASE = (() => {
      const normalize = (raw) => String(raw || "").trim().replace(/\/+$/g, "");
      const fromWindow = normalize(window.INTEL_API_BASE || window.__INTEL_API_BASE || "");
      const fromData = normalize(document.body?.dataset?.intelApiBase || "");
      const search = new URLSearchParams(window.location.search || "");
      const fromQuery = normalize(search.get("intel_api_base") || "");
      let fromStorage = "";
      try {
        fromStorage = normalize(localStorage.getItem(INTEL_API_BASE_STORAGE_KEY) || "");
      } catch (_error) {
        fromStorage = "";
      }
      const resolved = fromQuery || fromWindow || fromData || fromStorage;
      if (fromQuery) {
        try {
          localStorage.setItem(INTEL_API_BASE_STORAGE_KEY, fromQuery);
        } catch (_error) {
        }
      }
      return resolved;
    })();

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
      const eventRows = rows.filter((c) => String(c?.card_type || "").toLowerCase() === "event");
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
        const cardType = String(c?.card_type || "").toLowerCase();
        if (cardType !== "event") return false;
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
      if (!dt || Number.isNaN(dt.valueOf())) return "未定";
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const target = new Date(dt);
      target.setHours(0, 0, 0, 0);
      const diff = Math.round((target - now) / 86400000);
      if (diff > 0) return `未來 D-${diff}`;
      if (diff === 0) return "今天";
      return `過往 D+${Math.abs(diff)}`;
    }

    function categoryLabel(cardType) {
      const map = {
        event: "活動",
        feature: "即將功能",
        announcement: "公告",
        market: "市場",
        report: "報告",
        insight: "觀點",
      };
      return map[String(cardType || "")] || "資訊";
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
      report: "報告",
      announcement: "公告",
      feature: "功能",
      insight: "觀點",
    };

    function intelTypeLabel(type) {
      return intelTypeLabelMap[String(type || "").trim()] || "情報";
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
      reward: "獎勵",
      participation: "參與",
      audience: "對象",
      location: "地點",
      schedule: "時間",
    };

    function collectEventFactRows(item) {
      if (String(item?.card_type || "") !== "event") return [];
      const rows = [];
      const seen = new Set();
      const pushRow = (key, raw) => {
        const label = eventFactLabels[key];
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
        return truncateText(`${first.label}：${first.value}`, 84);
      }
      const glance = cleanMasterSummary(item?.glance || "");
      if (glance) return truncateText(glance, 90);
      const bullets = Array.isArray(item?.bullets) ? item.bullets : [];
      const firstBullet = bullets.find((x) => normalizeKeylineText(x));
      if (firstBullet) return truncateText(normalizeKeylineText(firstBullet), 92);
      const summary = cleanMasterSummary(item?.summary || "");
      if (summary) return truncateText(summary, 92);
      return "點開可查看完整 AI 整理、原文連結與圖片。";
    }

    function renderMasterTimelineCard(item, index, total, options = {}) {
      const preview = Boolean(options?.preview);
      const dt = resolveMasterTimelineDate(item);
      const bucket = currentTimelineBucket(dt);
      const eventText = dt ? toPosterDate(dt.toISOString()) : "--";
      const publishText = toLocalTime(item?.published_at);
      const cover = String(item?.cover_image || "");
      const backdropStyle = /^https?:\/\//i.test(cover)
        ? `background-image: url('${escapeHtml(cover)}');`
        : "background-image: linear-gradient(140deg, #1f3551, #2b4e73 46%, #29495b 100%);";
      const coverHtml = /^https?:\/\//i.test(cover)
        ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(item?.title || "timeline cover")}" loading="lazy" />`
        : "";
      const id = String(item?.id || "");
      const picked = Boolean(item?.manual_pick);
      const pinned = Boolean(item?.manual_pin);
      const bottomed = Boolean(item?.manual_bottom);
      const feedbackLabel = String(item?.card_type || "insight");
      const actionHtml = (!preview && id && intelCanEdit())
        ? `<div class="intel-actions">
            <button class="intel-pick-btn ${picked ? "is-picked" : ""}" data-intel-action="include" data-intel-id="${escapeHtml(id)}">${picked ? "已保留" : "保留"}</button>
            <button class="intel-pick-btn ${pinned ? "is-picked" : ""}" data-intel-action="${pinned ? "unpin" : "pin"}" data-intel-id="${escapeHtml(id)}">${pinned ? "已頂選" : "頂選"}</button>
            <button class="intel-pick-btn ${bottomed ? "is-picked" : ""}" data-intel-action="${bottomed ? "unbottom" : "bottom"}" data-intel-id="${escapeHtml(id)}">${bottomed ? "已置底" : "置底"}</button>
            <button class="intel-pick-btn" data-intel-action="exclude" data-intel-id="${escapeHtml(id)}">排除</button>
            <button class="intel-pick-btn" data-intel-action="feedback" data-intel-id="${escapeHtml(id)}" data-intel-label="${escapeHtml(feedbackLabel)}">回饋分類</button>
          </div>`
        : "";
      const keyline = cardPrimaryHighlight(item);
      const cleanTitle = cleanMasterTitle(item?.title || "未命名時間點");
      const toggleHtml = (!preview && id)
        ? `<button class="intel-master-toggle" type="button" data-intel-open-detail="${escapeHtml(id)}">詳細</button>`
        : "";

      return `
        <article class="intel-master-card ${preview ? "is-preview" : ""}" style="${backdropStyle}">
          <div class="intel-master-head">
            <span class="intel-master-kicker">@${escapeHtml(item?.account || "source")} · ${categoryLabel(item?.card_type)} · ${bucket}</span>
            <span class="intel-master-when">發布 ${escapeHtml(publishText)} · 事件 ${escapeHtml(eventText)}</span>
          </div>
          <div class="intel-master-media">${coverHtml}</div>
          <div class="intel-master-title-row">
            <h4 class="intel-master-title">${escapeHtml(cleanTitle || "未命名時間點")}</h4>
            ${toggleHtml}
          </div>
          ${keyline ? `<p class="intel-master-summary">${escapeHtml(keyline)}</p>` : ""}
          <div class="intel-master-footer">
            <span class="intel-master-index">${index + 1} / ${total}</span>
            ${actionHtml}
            <a class="intel-source-link" href="${escapeHtml(item?.url || "#")}" target="_blank" rel="noreferrer">原文</a>
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
        stage.innerHTML = `<p class="intel-masterline-empty">目前沒有可顯示的活動/功能時間軸資料。</p>`;
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
        return `<button class="intel-masterline-chip ${i === idx ? "is-active" : ""}" data-master-index="${i}" type="button"><span class="intel-masterline-date-row"><span class="intel-masterline-date">${escapeHtml(label)}</span>${today}</span><span class="intel-masterline-topic">${escapeHtml(topic)}</span></button>`;
      }).join("");
      const activeChip = rail.querySelector(".intel-masterline-chip.is-active");
      if (activeChip && typeof activeChip.scrollIntoView === "function") {
        activeChip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
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
      const cover = String(card.cover_image || "");
      const coverHtml = /^https?:\/\//i.test(cover)
        ? `<div class="intel-cover"><img src="${escapeHtml(cover)}" alt="${escapeHtml(card.title || "intel cover")}" loading="lazy" /></div>`
        : "";
      const tags = Array.isArray(card.tags) ? card.tags.slice(0, 3) : [];
      const tagHtml = tags
        .map((tag) => `<span class=\"intel-tag\">${escapeHtml(tag)}</span>`)
        .join("");
      const timelineText = card.timeline_date ? toPosterDate(card.timeline_date) : "";
      const timeText = `發布 ${toLocalTime(card.published_at)}${timelineText && timelineText !== "--" ? ` · 事件 ${timelineText}` : ""}`;
      const canPick = String(card.id || "").trim() !== "";
      const picked = Boolean(card.manual_pick);
      const pinned = Boolean(card.manual_pin);
      const bottomed = Boolean(card.manual_bottom);
      const actionHtml = (canPick && intelCanEdit())
        ? `<div class="intel-actions">
             <button class="intel-pick-btn ${picked ? "is-picked" : ""}" data-intel-action="include" data-intel-id="${escapeHtml(card.id)}">${picked ? "已保留" : "保留"}</button>
             <button class="intel-pick-btn ${pinned ? "is-picked" : ""}" data-intel-action="${pinned ? "unpin" : "pin"}" data-intel-id="${escapeHtml(card.id)}">${pinned ? "已頂選" : "頂選"}</button>
             <button class="intel-pick-btn ${bottomed ? "is-picked" : ""}" data-intel-action="${bottomed ? "unbottom" : "bottom"}" data-intel-id="${escapeHtml(card.id)}">${bottomed ? "已置底" : "置底"}</button>
             <button class="intel-pick-btn" data-intel-action="exclude" data-intel-id="${escapeHtml(card.id)}">排除</button>
             <button class="intel-pick-btn" data-intel-action="feedback" data-intel-id="${escapeHtml(card.id)}" data-intel-label="${escapeHtml(String(card.card_type || "insight"))}">回饋分類</button>
           </div>`
        : "";
      const keylineText = cardPrimaryHighlight(card);
      const keylineLabel = keylineText ? `<div class="intel-detail-block-title">一句話重點</div>` : "";

      if (layout === "poster") {
        return `
          <article class="intel-card layout-poster" data-intel-card-id="${escapeHtml(cardKey)}">
            <div class="intel-poster-top">
              <span class="intel-kicker">@${escapeHtml(card.account)} · ${typeLabel}</span>
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
              <a class="intel-source-link" href="${escapeHtml(card.url || "#")}" target="_blank" rel="noreferrer">原文</a>
            </div>
            ${card.url ? `<a class="intel-source-raw" href="${escapeHtml(card.url)}" target="_blank" rel="noreferrer">${escapeHtml(card.url)}</a>` : ""}
          </article>
        `;
      }

      return `
        <article class="intel-card layout-${layout}" data-intel-card-id="${escapeHtml(cardKey)}">
          <span class="intel-kicker">@${escapeHtml(card.account)} · ${typeLabel}</span>
          <h4 class="intel-title">${escapeHtml(card.title || "@source update")}</h4>
          ${keylineLabel}
          ${keylineText ? `<p class="intel-keyline">${escapeHtml(keylineText)}</p>` : ""}
          ${coverHtml}
          <div class="intel-footer">
            <div class="intel-tags">${tagHtml}</div>
            <span class="intel-time">${escapeHtml(timeText)}</span>
            ${actionHtml}
            <a class="intel-source-link" href="${escapeHtml(card.url || "#")}" target="_blank" rel="noreferrer">原文</a>
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

    function isOfficialAccount(account) {
      const handle = String(account || "").trim().toLowerCase().replace(/^@/, "");
      if (!handle) return false;
      return /^renaiss(?:_|cn|xyz|official)?/.test(handle);
    }

    function hasAny(text, terms) {
      return terms.some((term) => text.includes(term));
    }

    function hasStrictEventCall(text) {
      return /(join us|join on|register|signup|報名|报名|參加|参加|參與|参与|attend|attendees?|live\s+(session|stream|ama)|community\s*session|ama|space|tour|festival|meetup|線下|线下|venue|booth|地點|地点)/i.test(String(text || ""));
    }

    function isSbtThresholdNotice(text) {
      return /((sbt|soulbound|points?|積分|积分).{0,42}(threshold|snapshot|top\s*\d+%|門檻|快照|排名|rank))|((threshold|snapshot|top\s*\d+%|門檻|快照|排名|rank).{0,42}(sbt|soulbound|points?|積分|积分))/i.test(String(text || ""));
    }

    const TOPIC_LABELS = ["events", "official", "sbt", "pokemon", "alpha", "tools", "other"];

    function normalizeTopicLabels(value) {
      const raw = Array.isArray(value)
        ? value
        : (typeof value === "string" ? value.split(/[,\u3001/|\\\s]+/g) : []);
      const out = [];
      raw.forEach((item) => {
        const label = String(item || "").trim().toLowerCase();
        if (!label || !TOPIC_LABELS.includes(label) || out.includes(label)) return;
        out.push(label);
      });
      return out;
    }

    function inferFallbackTopicLabels(card) {
      const cardType = String(card?.card_type || "").toLowerCase();
      const text = cardTextBlob(card);
      const clsText = [
        String(card?.title || ""),
        String(card?.raw_text || ""),
        (card?.event_facts && typeof card.event_facts === "object")
          ? Object.values(card.event_facts).map((x) => String(x || "")).join(" ")
          : "",
      ].join(" ").toLowerCase();
      const hasTimeline = normalizeTimelineDate(card) instanceof Date;
      const hasEventFacts = Boolean(card?.event_facts && (card.event_facts.schedule || card.event_facts.participation));
      const isOfficial = isOfficialAccount(card?.account);
      const strictEventCall = hasStrictEventCall(clsText);
      const thresholdNotice = isSbtThresholdNotice(clsText);
      const labels = [];
      const add = (label) => {
        if (!TOPIC_LABELS.includes(label)) return;
        if (!labels.includes(label)) labels.push(label);
      };

      const eventKeywordRe = /(活動|直播|\bama\b|\bspace\b|\bsession\b|報名|參加|今晚|今天|明天|\bevent\b|\btour\b|\bfestival\b|\bmeetup\b)/i;
      const participationRe = /(報名|报名|參加|参加|參與|参与|attend|join|signup|register|discord|space|直播|\blive\b|\bama\b|\bsession\b)/i;
      const timePattern = /(?:\b[01]?\d[:：][0-5]\d\b|\butc[+\-]?\d+\b|\b(?:today|tonight|tomorrow)\b|\d+\s*月\s*\d+\s*(?:日|號)|今晚|明天|今天)/i;
      const explicitEventSignal = cardType === "event" || hasEventFacts || (eventKeywordRe.test(clsText) && timePattern.test(clsText));
      const looksEvent = explicitEventSignal
        || ((cardType !== "feature" && cardType !== "announcement") && hasTimeline && eventKeywordRe.test(clsText));

      let eventScore = 0;
      if (eventKeywordRe.test(clsText)) eventScore += 1;
      if (timePattern.test(clsText) || hasTimeline) eventScore += 1;
      if (participationRe.test(clsText)) eventScore += 2;
      if (/(hong\s*kong|taipei|台北|香港|venue|booth|地點|地点|線下|线下|festival|tour|meetup)/i.test(clsText)) eventScore += 1;
      if (strictEventCall) eventScore += 2;
      if (cardType === "event") eventScore += 1;
      let hasEventEvidence = looksEvent && eventScore >= 3 && (strictEventCall || hasEventFacts || participationRe.test(clsText) || /(festival|tour|meetup)/i.test(clsText));
      if (thresholdNotice && eventScore < 4) hasEventEvidence = false;

      if (hasEventEvidence) add("events");

      const rewardBlob = `${String(card?.event_facts?.reward || "")} ${String(card?.event_facts?.participation || "")} ${String(card?.event_facts?.audience || "")} ${String(card?.event_facts?.schedule || "")}`.toLowerCase();
      const sbtDirect = /\bsbt\b|soulbound/.test(clsText);
      const sbtThreshold = /(threshold|snapshot|top\s*\d+%|快照|門檻).{0,28}(points?|積分|分)|(points?|積分|分).{0,28}(threshold|snapshot|top\s*\d+%|快照|門檻)/.test(clsText);
      const sbtReward = /(reward|rewards|獎勵|奖励|airdrop|merch|周邊|周边).{0,24}(sbt|積分|积分|points?)|(sbt|積分|积分|points?).{0,24}(reward|rewards|獎勵|奖励|airdrop|merch|周邊|周边)/.test(clsText);
      const sbtFacts = /\bsbt\b|soulbound|積分|积分|points?|reward|獎勵|奖励|airdrop|snapshot|快照|threshold|門檻/.test(rewardBlob);
      if (sbtDirect || sbtThreshold || sbtReward || sbtFacts) add("sbt");

      const pokemonTerms = [
        "pokemon", "pokémon", "寶可夢", "口袋妖怪", "ptcg",
        "pikachu", "charizard", "mew", "mewtwo", "groudon", "eevee",
        "皮卡丘", "噴火龍", "超夢", "固拉多", "伊布",
      ];
      if (hasAny(clsText, pokemonTerms)) add("pokemon");

      const alphaTerms = ["alpha", "beta", "coming soon", "upcoming", "launch", "release", "roadmap", "上線", "即將", "預告", "功能更新"];
      if (cardType === "feature" || hasAny(clsText, alphaTerms)) add("alpha");

      const toolsTerms = ["攻略", "教學", "指南", "tool", "工具", "集運", "how to", "比價", "price compare", "報告整理"];
      if (cardType === "report" || (!isOfficial && hasAny(text, toolsTerms))) add("tools");

      if (isOfficial) add("official");
      if (!labels.length) add("other");
      return labels;
    }

    function cardTopicLabels(card) {
      const aiLabels = normalizeTopicLabels(card?.topic_labels);
      const fallback = inferFallbackTopicLabels(card);
      const merged = [...aiLabels];
      fallback.forEach((label) => {
        if (!merged.includes(label)) merged.push(label);
      });
      const clsText = [
        String(card?.title || ""),
        String(card?.raw_text || ""),
        (card?.event_facts && typeof card.event_facts === "object")
          ? Object.values(card.event_facts).map((x) => String(x || "")).join(" ")
          : "",
      ].join(" ").toLowerCase();
      const thresholdNotice = isSbtThresholdNotice(clsText);
      const strictEventCall = hasStrictEventCall(clsText);
      if (merged.includes("events")) {
        const cardType = String(card?.card_type || "").toLowerCase();
        const hasEventFacts = Boolean(card?.event_facts && (card.event_facts.schedule || card.event_facts.participation || card.event_facts.location));
        if ((cardType === "feature" || cardType === "announcement") && !strictEventCall && !hasEventFacts) {
          const idx = merged.indexOf("events");
          if (idx >= 0) merged.splice(idx, 1);
        }
        if (thresholdNotice && !strictEventCall && !hasEventFacts) {
          const idx = merged.indexOf("events");
          if (idx >= 0) merged.splice(idx, 1);
        }
      }
      if (!merged.length) return ["other"];
      return merged;
    }

    function isSameOrAfterToday(dt) {
      if (!(dt instanceof Date) || Number.isNaN(dt.valueOf())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(dt);
      target.setHours(0, 0, 0, 0);
      return target >= today;
    }

    function filterFutureAlphaCards(cards) {
      const rows = Array.isArray(cards) ? cards : [];
      return rows.filter((card) => {
        const cardType = String(card?.card_type || "").trim().toLowerCase();
        if (hasLiveReleaseSignal(card)) return false;
        const eventDate = resolveExplicitTimelineDate(card);
        // Alpha / Release Timeline 僅顯示「功能或公告」型卡片，避免混入市場與社群貼文。
        if (cardType !== "feature" && cardType !== "announcement") return false;
        if (eventDate instanceof Date) return isSameOrAfterToday(eventDate);
        return hasFutureReleaseSignal(card);
      });
    }

    function isPokemonCommunityCard(card) {
      const cardType = String(card?.card_type || "").trim().toLowerCase();
      if (isOfficialAccount(card?.account)) return false;
      if (cardType === "feature" || cardType === "announcement") return false;
      const blob = cardTextBlob(card);
      const pokemonCoreRe = /(pokemon|pok[eé]mon|寶可夢|口袋妖怪|ptcg|皮卡丘|噴火龍|超夢|固拉多|伊布|pikachu|charizard|mewtwo|groudon)/i;
      if (!pokemonCoreRe.test(blob)) return false;
      const valueRe = /(行情|價格|价格|市場|市场|成交|二級市場|二级市场|開箱|开箱|收藏|稀有卡|psa|grading|抽卡|開包|开包|pull)/i;
      const noisyEventRe = /(poker night|portaldot|ama|community session|discord|報名|报名|join us|tonight|today|tomorrow|utc\+?\d*)/i;
      if (cardType === "event" && noisyEventRe.test(blob) && !valueRe.test(blob)) return false;
      return true;
    }

    function dedupeAlphaCardsPreferOfficial(rows) {
      const items = Array.isArray(rows) ? rows : [];
      const normalizeTopic = (card) => String(card?.title || card?.glance || card?.summary || "")
        .replace(/\s+/g, " ")
        .replace(/^(活動重點|活動快訊|活動速報|功能進度|公告快訊|市場訊號|社群觀點|活動|功能|公告|市場|觀點)\s*[｜|:：\-]\s*/u, "")
        .replace(/[^\w\u4e00-\u9fff]+/g, " ")
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .slice(0, 8)
        .join(" ");
      const signatureOf = (card) => {
        const type = String(card?.card_type || "").trim().toLowerCase();
        const dt = resolveMasterTimelineDate(card);
        const dateSig = (dt instanceof Date && !Number.isNaN(dt.valueOf()))
          ? dt.toISOString().slice(0, 10)
          : String(card?.published_at || "").slice(0, 10);
        const topicSig = normalizeTopic(card);
        return `${type}|${dateSig}|${topicSig}`;
      };
      const score = (card) => {
        let s = 0;
        if (Boolean(card?.manual_pin)) s += 500;
        if (Boolean(card?.manual_bottom)) s -= 500;
        if (isOfficialAccount(card?.account)) s += 120;
        if (String(card?.cover_image || "").trim()) s += 8;
        s += Number(card?.importance || 0);
        s += toTimestamp(card?.published_at) / 1e13;
        return s;
      };
      const alphaTheme = (card) => {
        const blob = cardTextBlob(card);
        if (/(mfa|2fa|multi[-\s]*factor|authenticator|帳號安全|账号安全)/i.test(blob)) return "mfa";
        if (/(sbt|soulbound|points?|積分|积分|threshold|snapshot|top\s*\d+%|門檻|快照|beta\s*2\.0)/i.test(blob)) return "sbt";
        if (/(omega|restock|pack|卡包|抽卡|pull|gacha)/i.test(blob)) return "pack";
        if (/(one\s*piece|infinite gacha|op-\d+)/i.test(blob)) return "onepiece";
        return "other";
      };
      const tokenSet = (card) => {
        const text = normalizeTopic(card) + " " + String(card?.summary || "").toLowerCase();
        const tokens = text
          .replace(/[^\w\u4e00-\u9fff]+/g, " ")
          .split(/\s+/)
          .map((x) => x.trim())
          .filter((x) => x.length >= 2)
          .slice(0, 40);
        return new Set(tokens);
      };
      const overlap = (a, b) => {
        if (!a.size || !b.size) return 0;
        let hit = 0;
        a.forEach((t) => { if (b.has(t)) hit += 1; });
        return hit / Math.max(a.size, b.size);
      };
      const dateStamp = (card) => {
        const dt = resolveMasterTimelineDate(card);
        if (dt instanceof Date && !Number.isNaN(dt.valueOf())) return dt.valueOf();
        return toTimestamp(card?.published_at);
      };
      const chosen = new Map();
      items.forEach((card) => {
        const sig = signatureOf(card);
        const prev = chosen.get(sig);
        if (!prev || score(card) > score(prev)) {
          chosen.set(sig, card);
        }
      });
      const deduped = [...chosen.values()];
      const official = deduped.filter((x) => isOfficialAccount(x?.account));
      const officialByTheme = new Map();
      official.forEach((x) => {
        const t = alphaTheme(x);
        if (!officialByTheme.has(t)) officialByTheme.set(t, []);
        officialByTheme.get(t).push(x);
      });
      const finalRows = [];
      deduped.forEach((card) => {
        if (isOfficialAccount(card?.account)) {
          finalRows.push(card);
          return;
        }
        const theme = alphaTheme(card);
        const peers = officialByTheme.get(theme) || [];
        if (!peers.length || theme === "other") {
          finalRows.push(card);
          return;
        }
        const toks = tokenSet(card);
        const ts = dateStamp(card);
        let shouldDrop = false;
        peers.forEach((off) => {
          if (shouldDrop) return;
          const ov = overlap(toks, tokenSet(off));
          const dtDiff = Math.abs(ts - dateStamp(off)) / 86400000;
          if (ov >= 0.18 || dtDiff <= 5) {
            shouldDrop = true;
          }
        });
        if (!shouldDrop) finalRows.push(card);
      });
      return sortCardsByTimeDesc(finalRows);
    }

    function resolveCardWindowDate(item) {
      const cardType = String(item?.card_type || "").trim().toLowerCase();
      if (cardType === "event" || cardType === "feature" || cardType === "announcement") {
        const dt = resolveMasterTimelineDate(item);
        if (dt instanceof Date && !Number.isNaN(dt.valueOf())) return dt;
      }
      const published = String(item?.published_at || "").trim();
      if (!published) return null;
      const dt = new Date(published);
      if (Number.isNaN(dt.valueOf())) return null;
      return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    }

    function isWithinBiweekWindow(item) {
      const dt = resolveCardWindowDate(item);
      if (!(dt instanceof Date) || Number.isNaN(dt.valueOf())) return false;
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      const target = new Date(dt);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.round((target - base) / 86400000);
      return Math.abs(diffDays) <= 14;
    }

    function routeIntelCards(cards) {
      const buckets = {
        events: [],
        official: [],
        sbt: [],
        pokemon: [],
        alpha: [],
        tools: [],
        other: [],
      };
      const seenByBucket = {
        events: new Set(),
        official: new Set(),
        sbt: new Set(),
        pokemon: new Set(),
        alpha: new Set(),
        tools: new Set(),
        other: new Set(),
      };
      (Array.isArray(cards) ? cards : []).forEach((card) => {
        const labels = cardTopicLabels(card);
        const key = cardStableKey(card);
        const normalized = { ...card, route_labels: labels, _card_key: key };
        if (normalized.manual_pin && !labels.includes("other")) labels.push("other");
        const keepByWindow = Boolean(normalized.manual_pin) || isWithinBiweekWindow(normalized);
        if (!keepByWindow) return;
        labels.forEach((label) => {
          const bucket = buckets[label] ? label : "other";
          if (bucket === "pokemon" && !isPokemonCommunityCard(normalized)) return;
          const seen = seenByBucket[bucket];
          if (seen.has(key)) return;
          seen.add(key);
          buckets[bucket].push(normalized);
        });
      });
      Object.keys(buckets).forEach((key) => {
        buckets[key] = sortCardsByTimeDesc(buckets[key]);
        if (key === "alpha") {
          buckets[key] = dedupeAlphaCardsPreferOfficial(buckets[key]);
        }
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

    function renderCardGrid(containerId, emptyId, cards, emptyText) {
      const wrap = document.getElementById(containerId);
      const empty = document.getElementById(emptyId);
      if (!wrap || !empty) return;
      const rows = Array.isArray(cards) ? cards : [];
      wrap.innerHTML = rows.map((card) => intelCardHtml(card)).join("");
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

    const uiTextNodeCache = new WeakMap();
    const uiTranslationMemo = new Map();
    let uiTranslateVersion = 0;
    const UI_TRANSLATION_FALLBACKS = {
      en: {
        "語言": "Language",
        "活動": "Events",
        "官方更新": "Official",
        "寶可夢": "Pokemon",
        "未來 Alpha": "Future Alpha",
        "工具": "Tools",
        "社群精選": "Community Picks",
        "主分類導覽": "Main Categories",
        "目前顯示：活動。": "Showing: Events.",
        "目前顯示：官方近期更新。": "Showing: Recent Official Updates.",
        "目前顯示：SBT。": "Showing: SBT.",
        "目前顯示：寶可夢相關資訊。": "Showing: Pokemon-related Info.",
        "目前顯示：未來 Alpha。": "Showing: Future Alpha.",
        "目前顯示：工具。": "Showing: Tools.",
        "目前顯示：社群精選。": "Showing: Community Picks.",
        "從這裡切換分區，只顯示你要看的類別。": "Switch sections here and show only the category you want.",
        "活動與功能主時間軸（左右滑動）": "Event Main Timeline (swipe sideways)",
        "滑動卡片或點上方時間點，即可快轉查看該日期內容。": "Swipe cards or tap a time point to jump to that date.",
        "活動與功能組時間軸": "Event Timeline",
        "官方近期更新": "Recent Official Updates",
        "官方近期更新 / Official Updates": "Recent Official Updates / Official Updates",
        "活動主時間軸（左右滑動）": "Event Main Timeline (swipe sideways)",
        "活動主時間軸": "Event Main Timeline",
        "寶可夢相關資訊 / TCG Pro Pipeline": "Pokemon-related Info / TCG Pro Pipeline",
        "未來 Alpha / Release Timeline": "Future Alpha / Release Timeline",
        "社群精選 / Community Picks": "Community Picks / Community Picks",
        "工具 / Community Toolbox": "Tools / Community Toolbox",
        "同步最近 30 天": "Sync Last 30 Days",
        "管理登入": "Admin Login",
        "管理員登入": "Admin Login",
        "登出": "Logout",
        "AI Agent 監控面板": "AI Agent Monitor",
        "AI 監控": "AI Monitor",
        "刷新狀態": "Refresh Status",
        "同步狀態": "Sync Status",
        "新貼文狀態": "New Posts",
        "背景整理任務": "Background Jobs",
        "新聞/語言刷新": "News / Language Refresh",
        "最近整理任務": "Recent Jobs",
        "監控來源狀態": "Monitor Sources",
        "登入": "Login",
        "關閉": "Close",
      },
      ko: {
        "語言": "언어",
        "活動": "이벤트",
        "官方更新": "공식 업데이트",
        "寶可夢": "포켓몬",
        "未來 Alpha": "향후 Alpha",
        "工具": "도구",
        "社群精選": "커뮤니티 픽",
        "主分類導覽": "주요 카테고리",
        "從這裡切換分區，只顯示你要看的類別。": "여기서 섹션을 전환해 원하는 카테고리만 보세요.",
        "官方近期更新": "공식 최근 업데이트",
        "活動主時間軸": "이벤트 메인 타임라인",
        "活動與功能主時間軸（左右滑動）": "이벤트 메인 타임라인 (좌우 스와이프)",
        "同步最近 30 天": "최근 30일 동기화",
        "管理登入": "관리자 로그인",
        "管理員登入": "관리자 로그인",
        "登出": "로그아웃",
        "AI Agent 監控面板": "AI 에이전트 모니터",
        "AI 監控": "AI 모니터",
        "刷新狀態": "상태 새로고침",
      },
      "zh-Hans": {
        "語言": "语言",
        "活動": "活动",
        "官方更新": "官方更新",
        "寶可夢": "宝可梦",
        "未來 Alpha": "未来 Alpha",
        "工具": "工具",
        "社群精選": "社群精选",
        "主分類導覽": "主分类导览",
        "從這裡切換分區，只顯示你要看的類別。": "从这里切换分区，只显示你要看的类别。",
        "活動與功能主時間軸（左右滑動）": "活动主时间轴（左右滑动）",
        "滑動卡片或點上方時間點，即可快轉查看該日期內容。": "滑动卡片或点上方时间点，即可快转查看该日期内容。",
        "官方近期更新": "官方近期更新",
        "活動主時間軸": "活动主时间轴",
        "同步最近 30 天": "同步最近 30 天",
        "管理登入": "管理登录",
        "管理員登入": "管理员登录",
        "登出": "登出",
        "AI Agent 監控面板": "AI Agent 监控面板",
        "AI 監控": "AI 监控",
        "刷新狀態": "刷新状态",
      },
    };

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

