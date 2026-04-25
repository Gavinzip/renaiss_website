    const INTEL_API_BASE_STORAGE_KEY = "intel_api_base";
    const INTEL_LANG_STORAGE_KEY = "intel_ui_lang";
    const uiTextNodeCache = new WeakMap();
    const uiTranslationMemo = new Map();
    let uiTranslateVersion = 0;
    const GAME_UI_TRANSLATIONS = {
      "zh-Hans": {
        "氣候": "气候",
        "動態氣候 / Dynamic Climate": "动态气候 / Dynamic Climate",
        "Climate States": "气候状态",
        "這不是背景換色，而是同一個世界在四種氣候裡露出四種節奏。晴空讓你推進，降雨帶來變數，旱象逼你精算，降雪把每一步都壓得更重。": "这不是背景换色，而是同一个世界在四种气候里露出四种节奏。晴空让你推进，降雨带来变数，旱象逼你精算，降雪把每一步都压得更重。",
        "同一條路，氣候一變，打法就跟著變。": "同一条路，气候一变，打法就跟着变。",
        "晴空 / Clear Sky · 推進期": "晴空 / Clear Sky · 推进期",
        "降雨 / Rainfall · 變數期": "降雨 / Rainfall · 变数期",
        "旱象 / Drought · 緊縮期": "旱象 / Drought · 紧缩期",
        "降雪 / Snowfall · 試煉期": "降雪 / Snowfall · 试炼期",
        "視野乾淨，節奏平穩，適合推主線、探圖、整理資源，像替下一段冒險先鋪好路。": "视野干净，节奏平稳，适合推主线、探图、整理资源，像替下一段冒险先铺好路。",
        "光線、路面與事件節奏都開始變動，適合快推、快收、快離場，每一步都更講究判斷。": "光线、路面与事件节奏都开始变动，适合快推、快收、快离场，每一步都更讲究判断。",
        "補給與撤退都變得尖銳，錯一步就會被放大。這種氣候會逼你把每個選擇算得更狠。": "补给与撤退都变得尖锐，错一步就会被放大。这种气候会逼你把每个选择算得更狠。",
        "節奏放慢、能見度壓低，但也讓每一步都更有重量。真正的判斷力，會在這種時候被看見。": "节奏放慢、能见度压低，但也让每一步都更有重量。真正的判断力，会在这种时候被看见。"
      },
      en: {
        "氣候": "Climate",
        "動態氣候 / Dynamic Climate": "Dynamic Climate",
        "Climate States": "Climate States",
        "這不是背景換色，而是同一個世界在四種氣候裡露出四種節奏。晴空讓你推進，降雨帶來變數，旱象逼你精算，降雪把每一步都壓得更重。": "This is not a simple background swap. The same world exposes four different rhythms through four climate states: clear skies help you advance, rainfall adds uncertainty, drought forces tighter planning, and snowfall makes every step heavier.",
        "同一條路，氣候一變，打法就跟著變。": "Same road, different climate, different way to play.",
        "晴空 / Clear Sky · 推進期": "Clear Sky · Advance Phase",
        "降雨 / Rainfall · 變數期": "Rainfall · Variable Phase",
        "旱象 / Drought · 緊縮期": "Drought · Constraint Phase",
        "降雪 / Snowfall · 試煉期": "Snowfall · Trial Phase",
        "視野乾淨，節奏平穩，適合推主線、探圖、整理資源，像替下一段冒險先鋪好路。": "Clean visibility and stable pacing make this the best state for pushing the main route, scouting, and preparing resources for the next stretch.",
        "光線、路面與事件節奏都開始變動，適合快推、快收、快離場，每一步都更講究判斷。": "Light, terrain, and event timing start shifting. It rewards quick pushes, quick exits, and sharper judgment.",
        "補給與撤退都變得尖銳，錯一步就會被放大。這種氣候會逼你把每個選擇算得更狠。": "Supply and retreat decisions become harsher. One bad move gets amplified, forcing you to calculate every choice harder.",
        "節奏放慢、能見度壓低，但也讓每一步都更有重量。真正的判斷力，會在這種時候被看見。": "The pace slows and visibility drops, but every move carries more weight. This is where real judgment shows."
      },
      ko: {
        "氣候": "기후",
        "動態氣候 / Dynamic Climate": "동적 기후",
        "Climate States": "기후 상태",
        "這不是背景換色，而是同一個世界在四種氣候裡露出四種節奏。晴空讓你推進，降雨帶來變數，旱象逼你精算，降雪把每一步都壓得更重。": "단순한 배경 교체가 아닙니다. 같은 세계가 네 가지 기후에서 서로 다른 리듬을 드러냅니다. 맑은 하늘은 전진을 돕고, 비는 변수를 만들고, 가뭄은 계산을 강요하며, 눈은 모든 선택을 더 무겁게 만듭니다.",
        "同一條路，氣候一變，打法就跟著變。": "같은 길이라도 기후가 바뀌면 플레이 방식도 바뀝니다.",
        "晴空 / Clear Sky · 推進期": "맑음 · 전진 단계",
        "降雨 / Rainfall · 變數期": "강우 · 변수 단계",
        "旱象 / Drought · 緊縮期": "가뭄 · 압박 단계",
        "降雪 / Snowfall · 試煉期": "강설 · 시련 단계",
        "視野乾淨，節奏平穩，適合推主線、探圖、整理資源，像替下一段冒險先鋪好路。": "시야가 깨끗하고 흐름이 안정적이라 메인 진행, 탐색, 자원 정리에 적합합니다. 다음 모험을 위한 길을 미리 닦는 단계입니다.",
        "光線、路面與事件節奏都開始變動，適合快推、快收、快離場，每一步都更講究判斷。": "빛, 지형, 이벤트 흐름이 흔들리기 시작합니다. 빠르게 밀고, 빠르게 회수하고, 빠르게 빠지는 판단이 중요합니다.",
        "補給與撤退都變得尖銳，錯一步就會被放大。這種氣候會逼你把每個選擇算得更狠。": "보급과 후퇴가 더 날카로운 선택이 됩니다. 한 번의 실수가 커지기 때문에 모든 결정을 더 냉정하게 계산해야 합니다.",
        "節奏放慢、能見度壓低，但也讓每一步都更有重量。真正的判斷力，會在這種時候被看見。": "속도는 느려지고 시야는 낮아지지만, 그만큼 모든 걸음의 무게가 커집니다. 진짜 판단력은 이런 순간에 드러납니다."
      }
    };

    function normalizeUiLang(raw) {
      const text = String(raw || "").trim().toLowerCase();
      if (!text) return "zh-Hant";
      if (text.startsWith("zh-hant") || text === "zh-tw" || text === "zh-hk" || text === "zh-mo") return "zh-Hant";
      if (text.startsWith("zh")) return "zh-Hans";
      if (text.startsWith("ko")) return "ko";
      if (text.startsWith("en")) return "en";
      return "zh-Hant";
    }

    const INTEL_API_BASE = (() => {
      const normalize = (raw) => String(raw || "").trim().replace(/\/+$/g, "");
      const fromWindow = normalize(window.INTEL_API_BASE || window.__INTEL_API_BASE || "");
      const search = new URLSearchParams(window.location.search || "");
      const fromQuery = normalize(search.get("intel_api_base") || "");
      let fromStorage = "";
      try {
        fromStorage = normalize(localStorage.getItem(INTEL_API_BASE_STORAGE_KEY) || "");
      } catch (_error) {
        fromStorage = "";
      }
      const localHost = /^(127\.0\.0\.1|localhost|::1)$/i.test(String(window.location.hostname || ""));
      const safeStorage = localHost && !fromQuery && !fromWindow ? "" : fromStorage;
      const resolved = fromQuery || fromWindow || safeStorage;
      if (fromQuery) {
        try {
          localStorage.setItem(INTEL_API_BASE_STORAGE_KEY, fromQuery);
        } catch (_error) {}
      }
      return resolved;
    })();

    function readSavedUiLang() {
      const search = new URLSearchParams(window.location.search || "");
      const fromQuery = search.get("lang") || "";
      let saved = "";
      try {
        saved = String(localStorage.getItem(INTEL_LANG_STORAGE_KEY) || "").trim();
      } catch (_error) {
        saved = "";
      }
      return normalizeUiLang(fromQuery || saved || document.documentElement.lang || navigator.language || "zh-Hant");
    }

    let currentUiLang = readSavedUiLang();
    document.documentElement.lang = currentUiLang;

    function saveUiLang(lang) {
      currentUiLang = normalizeUiLang(lang);
      document.documentElement.lang = currentUiLang;
      try {
        localStorage.setItem(INTEL_LANG_STORAGE_KEY, currentUiLang);
      } catch (_error) {}
      return currentUiLang;
    }

    function intelApiUrl(path) {
      const tail = String(path || "").trim();
      if (!INTEL_API_BASE) return tail;
      if (!tail) return INTEL_API_BASE;
      if (/^https?:\/\//i.test(tail)) return tail;
      if (tail.startsWith("/")) return `${INTEL_API_BASE}${tail}`;
      return `${INTEL_API_BASE}/${tail}`;
    }

    function shouldTranslateTextNode(node) {
      if (!node || node.nodeType !== Node.TEXT_NODE) return false;
      const parent = node.parentElement;
      if (!parent) return false;
      if (parent.closest("[data-no-i18n='1']")) return false;
      const tag = String(parent.tagName || "").toUpperCase();
      if (["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "OPTION"].includes(tag)) return false;
      const text = String(node.nodeValue || "").replace(/\s+/g, " ").trim();
      if (!text || text.length < 2) return false;
      if (/^https?:\/\//i.test(text)) return false;
      return true;
    }

    function collectTranslatableTextNodes(root) {
      const nodes = [];
      const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return shouldTranslateTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
      return nodes;
    }

    async function requestTranslateTexts(lang, texts) {
      const response = await fetch(intelApiUrl("/api/intel/translate-texts"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, texts }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      return data.items.map((x) => String(x || ""));
    }

    async function translateTextsForUi(lang, texts) {
      const tag = normalizeUiLang(lang);
      const rows = Array.isArray(texts) ? texts.map((x) => String(x || "")) : [];
      if (tag === "zh-Hant") return rows;
      const out = rows.slice();
      const missing = [];
      const missingSet = new Set();
      rows.forEach((text) => {
        if (!text) return;
        const key = `${tag}\n${text}`;
        const local = GAME_UI_TRANSLATIONS[tag]?.[text];
        if (local) {
          uiTranslationMemo.set(key, local);
          return;
        }
        if (!uiTranslationMemo.has(key) && !missingSet.has(text)) {
          missingSet.add(text);
          missing.push(text);
        }
      });
      if (missing.length) {
        const chunkSize = 80;
        for (let i = 0; i < missing.length; i += chunkSize) {
          const chunk = missing.slice(i, i + chunkSize);
          let translated = [];
          try {
            translated = await requestTranslateTexts(tag, chunk);
          } catch (_error) {
            translated = chunk.slice();
          }
          chunk.forEach((text, idx) => {
            const key = `${tag}\n${text}`;
            const value = String(translated[idx] || text).trim() || text;
            uiTranslationMemo.set(key, value);
          });
        }
      }
      rows.forEach((text, idx) => {
        if (!text) return;
        const key = `${tag}\n${text}`;
        out[idx] = uiTranslationMemo.get(key) || text;
      });
      return out;
    }

    async function applyUiLanguage() {
      const version = ++uiTranslateVersion;
      const nodes = collectTranslatableTextNodes(document.body);
      const originals = nodes.map((node) => {
        const stored = uiTextNodeCache.get(node);
        const current = String(node.nodeValue || "");
        if (typeof stored === "string") {
          if (currentUiLang === "zh-Hant") {
            uiTextNodeCache.set(node, current);
            return current;
          }
          if (/[\u3400-\u9fff]/.test(current) && current !== stored) {
            uiTextNodeCache.set(node, current);
            return current;
          }
          return stored;
        }
        uiTextNodeCache.set(node, current);
        return current;
      });
      if (currentUiLang === "zh-Hant") {
        nodes.forEach((node, idx) => {
          node.nodeValue = originals[idx];
        });
        return;
      }
      const translated = await translateTextsForUi(currentUiLang, originals);
      if (version !== uiTranslateVersion) return;
      nodes.forEach((node, idx) => {
        node.nodeValue = String(translated[idx] || originals[idx] || "");
      });
    }

    function seasonStageNames() {
      if (currentUiLang === "en") {
        return ["CLEAR SKY", "RAINFALL", "DROUGHT", "SNOWFALL"];
      }
      if (currentUiLang === "ko") {
        return ["맑음", "강우", "가뭄", "강설"];
      }
      if (currentUiLang === "zh-Hans") {
        return ["晴空", "降雨", "旱象", "降雪"];
      }
      return ["CLEAR / 晴空", "RAINFALL / 降雨", "DROUGHT / 旱象", "SNOWFALL / 降雪"];
    }

    async function syncLanguageFromSavedState() {
      const next = readSavedUiLang();
      if (next === currentUiLang) return;
      saveUiLang(next);
      try {
        await applyUiLanguage();
        window.dispatchEvent(new CustomEvent("game:langchange", { detail: { lang: currentUiLang } }));
      } catch (error) {
        console.warn("language sync failed", error);
      }
    }

    function setupLanguageSync() {
      window.addEventListener("storage", (event) => {
        if (event.key !== INTEL_LANG_STORAGE_KEY) return;
        syncLanguageFromSavedState().catch(() => {});
      });
      window.addEventListener("pageshow", () => {
        syncLanguageFromSavedState().catch(() => {});
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("inview");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".reveal").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9) {
        el.classList.add("inview");
      } else {
        observer.observe(el);
      }
    });

    function initSeasonComparator() {
      const section = document.getElementById("seasons");
      if (!section) return;
      const comparator = section.querySelector("[data-season-comparator]");
      if (!comparator) return;

      const layers = Array.from(comparator.querySelectorAll(".season-layer"));
      const divider = comparator.querySelector("[data-season-divider]");
      const progressFill = comparator.querySelector("[data-season-progress]");
      const currentLabel = comparator.querySelector("[data-season-current]");
      const indexLabel = comparator.querySelector("[data-season-index]");
      const dots = Array.from(comparator.querySelectorAll("[data-season-dot]"));

      if (!layers.length) return;
      const stageCount = layers.length;
      let ticking = false;

      function clamp01(value) {
        return Math.max(0, Math.min(1, value));
      }

      function getProgress() {
        const start = section.offsetTop;
        const distance = Math.max(1, section.offsetHeight - window.innerHeight);
        return clamp01((window.scrollY - start) / distance);
      }

      function setStageByProgress(progress) {
        const p = clamp01(progress);
        const maxIndex = stageCount - 1;
        const floatStage = p * maxIndex;
        const base = Math.floor(floatStage);
        const local = base >= maxIndex ? 1 : floatStage - base;

        layers.forEach((layer) => {
          layer.classList.remove("is-active", "is-next");
          layer.style.opacity = "0";
          layer.style.zIndex = "1";
          layer.style.clipPath = "inset(0 0 0 0)";
        });

        if (base >= maxIndex) {
          const layer = layers[maxIndex];
          layer.classList.add("is-active");
          layer.style.opacity = "1";
          layer.style.zIndex = "3";
          if (divider) divider.style.opacity = "0";
        } else {
          const current = layers[base];
          const next = layers[base + 1];
          const leftInset = clamp01(1 - local) * 100;

          current.classList.add("is-active");
          current.style.opacity = "1";
          current.style.zIndex = "2";

          next.classList.add("is-next");
          next.style.opacity = "1";
          next.style.zIndex = "3";
          next.style.clipPath = `inset(0 0 0 ${leftInset}%)`;

          if (divider) {
            divider.style.opacity = "1";
            divider.style.left = `${leftInset}%`;
          }
        }

        const activeStage = Math.min(maxIndex, Math.round(floatStage));
        const names = seasonStageNames();
        if (currentLabel) currentLabel.textContent = names[activeStage] || `STAGE ${activeStage + 1}`;
        if (indexLabel) indexLabel.textContent = `${String(activeStage + 1).padStart(2, "0")} / ${String(stageCount).padStart(2, "0")}`;
        if (progressFill) progressFill.style.width = `${Math.round(p * 100)}%`;
        dots.forEach((dot, i) => dot.classList.toggle("is-active", i === activeStage));
      }

      function update() {
        setStageByProgress(getProgress());
      }

      function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          update();
        });
      }

      dots.forEach((dot, idx) => {
        dot.addEventListener("click", () => {
          const distance = Math.max(1, section.offsetHeight - window.innerHeight);
          const ratio = idx / Math.max(1, stageCount - 1);
          const target = section.offsetTop + distance * ratio;
          window.scrollTo({ top: target, behavior: "smooth" });
        });
      });

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", update, { passive: true });
      window.addEventListener("game:langchange", update);
      update();
    }

    function initScrollyLayouts() {
      const layouts = document.querySelectorAll("[data-scrolly]");
      layouts.forEach((layout) => {
        const section = layout.closest(".chapter");
        if (!section) return;
        const mode = String(layout.dataset.scrollyMode || "comparator").trim().toLowerCase();
        const isStackLayout = mode === "stack";
        const track = layout.querySelector(".scrolly-track");
        if (!track) return;
        const items = Array.from(layout.querySelectorAll(".scrolly-item"));
        if (!items.length) return;
        const cards = items.map((item) => item.querySelector(".scrolly-card")).filter(Boolean);
        if (!cards.length) return;
        const fill = layout.querySelector("[data-scrolly-fill]");
        const counter = layout.querySelector("[data-scrolly-count]");
        const desktopQuery = window.matchMedia("(min-width: 981px)");
        let divider = track.querySelector(".scrolly-wipe-divider");
        if (!divider) {
          divider = document.createElement("div");
          divider.className = "scrolly-wipe-divider";
          track.appendChild(divider);
        }
        let nav = track.querySelector(".scrolly-stage-nav");
        if (!nav) {
          nav = document.createElement("div");
          nav.className = "scrolly-stage-nav";
          cards.forEach((_, idx) => {
            const dot = document.createElement("button");
            dot.className = "scrolly-stage-dot";
            dot.type = "button";
            dot.setAttribute("aria-label", `Go to stage ${idx + 1}`);
            dot.dataset.scrollyDot = String(idx);
            nav.appendChild(dot);
          });
          track.appendChild(nav);
        }
        const dots = Array.from(nav.querySelectorAll("[data-scrolly-dot]"));
        let activeIndex = 0;
        let ticking = false;
        let isDesktopMode = false;

        function clamp01(value) {
          return Math.max(0, Math.min(1, value));
        }

        function updateMeter(index, progress) {
          const safe = Math.max(0, Math.min(index, cards.length - 1));
          const pct = Math.max(0, Math.min(1, progress));
          activeIndex = safe;
          if (fill) fill.style.width = `${Math.round(pct * 100)}%`;
          if (counter) counter.textContent = `${String(safe + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
          dots.forEach((dot, i) => dot.classList.toggle("is-active", i === safe));
        }

        function setActive(index) {
          const safe = Math.max(0, Math.min(index, items.length - 1));
          items.forEach((item, i) => {
            item.classList.toggle("is-active", i === safe);
            item.classList.toggle("is-past", i < safe);
            item.classList.toggle("is-next", i === safe + 1);
          });
          const progress = items.length === 1 ? 1 : safe / Math.max(1, items.length - 1);
          updateMeter(safe, progress);
        }

        function setSectionHeight() {
          if (!isDesktopMode || isStackLayout) {
            section.style.minHeight = "";
            delete section.dataset.scrollyHeight;
            return;
          }
          const perStage = Math.max(window.innerHeight * 0.9, 680);
          const totalHeight = perStage * Math.max(1, cards.length - 1) + window.innerHeight * 1.15;
          const px = `${Math.round(totalHeight)}px`;
          if (section.dataset.scrollyHeight !== px) {
            section.style.minHeight = px;
            section.dataset.scrollyHeight = px;
          }
        }

        function getProgress() {
          const start = section.offsetTop;
          const distance = Math.max(1, section.offsetHeight - window.innerHeight);
          return clamp01((window.scrollY - start) / distance);
        }

        function findNearestVisibleIndexInTrack() {
          const rect = track.getBoundingClientRect();
          const centerY = rect.top + rect.height * 0.42;
          let best = 0;
          let bestDist = Infinity;
          items.forEach((item, idx) => {
            const itemRect = item.getBoundingClientRect();
            const dist = Math.abs(itemRect.top + itemRect.height * 0.5 - centerY);
            if (dist < bestDist) {
              bestDist = dist;
              best = idx;
            }
          });
          return best;
        }

        function renderComparator(progress) {
          const p = clamp01(progress);
          const maxIndex = cards.length - 1;
          const floatStage = p * maxIndex;
          const base = Math.floor(floatStage);
          const local = base >= maxIndex ? 1 : floatStage - base;

          cards.forEach((card, i) => {
            card.style.opacity = "0";
            card.style.zIndex = "1";
            card.style.clipPath = "inset(0 0 0 0)";
            items[i].classList.remove("is-active", "is-past", "is-next");
          });

          if (base >= maxIndex) {
            cards[maxIndex].style.opacity = "1";
            cards[maxIndex].style.zIndex = "3";
            items[maxIndex].classList.add("is-active");
            if (divider) divider.style.opacity = "0";
          } else {
            const current = cards[base];
            const next = cards[base + 1];
            const leftInset = clamp01(1 - local) * 100;

            current.style.opacity = "1";
            current.style.zIndex = "2";
            next.style.opacity = "1";
            next.style.zIndex = "3";
            next.style.clipPath = `inset(0 0 0 ${leftInset}%)`;

            items[base].classList.add("is-active");
            items[base + 1].classList.add("is-next");
            for (let i = 0; i < base; i++) items[i].classList.add("is-past");

            if (divider) {
              divider.style.opacity = "1";
              divider.style.left = `${leftInset}%`;
            }
          }

          const focus = Math.min(maxIndex, Math.round(floatStage));
          updateMeter(focus, p);
        }

        function findNearestVisibleIndex() {
          const centerY = window.innerHeight * 0.5;
          let best = 0;
          let bestDist = Infinity;
          items.forEach((item, idx) => {
            const rect = item.getBoundingClientRect();
            const dist = Math.abs(rect.top + rect.height * 0.5 - centerY);
            if (dist < bestDist) {
              bestDist = dist;
              best = idx;
            }
          });
          return best;
        }

        function applyMode() {
          const shouldDesktop = desktopQuery.matches;
          if (shouldDesktop === isDesktopMode) return;
          isDesktopMode = shouldDesktop;
          layout.classList.toggle("is-comparator", isDesktopMode && !isStackLayout);
          layout.classList.toggle("is-stack", isDesktopMode && isStackLayout);
          section.classList.toggle("scrolly-chapter", isDesktopMode && !isStackLayout);
          if (!isDesktopMode) {
            cards.forEach((card) => {
              card.style.opacity = "1";
              card.style.zIndex = "1";
              card.style.clipPath = "inset(0 0 0 0)";
            });
            if (divider) divider.style.opacity = "0";
          } else if (isStackLayout) {
            cards.forEach((card) => {
              card.style.opacity = "1";
              card.style.zIndex = "1";
              card.style.clipPath = "inset(0 0 0 0)";
            });
            if (divider) divider.style.opacity = "0";
          }
          setSectionHeight();
        }

        function update() {
          applyMode();
          if (isDesktopMode && !isStackLayout) {
            renderComparator(getProgress());
          } else if (isDesktopMode && isStackLayout) {
            setActive(findNearestVisibleIndexInTrack());
          } else {
            setActive(findNearestVisibleIndex());
          }
        }

        function onScroll() {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            ticking = false;
            update();
          });
        }

        dots.forEach((dot, idx) => {
          dot.addEventListener("click", () => {
            if (!isDesktopMode || isStackLayout) {
              items[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            const distance = Math.max(1, section.offsetHeight - window.innerHeight);
            const ratio = idx / Math.max(1, cards.length - 1);
            const target = section.offsetTop + distance * ratio;
            window.scrollTo({ top: target, behavior: "smooth" });
          });
        });

        window.addEventListener("scroll", onScroll, { passive: true });
        track.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", () => {
          setSectionHeight();
          update();
        }, { passive: true });
        update();
      });
    }

    requestAnimationFrame(() => {
      document.body.classList.add("page-ready");
    });

    setupLanguageSync();
    applyUiLanguage().catch(() => {});
    initSeasonComparator();
    initScrollyLayouts();
