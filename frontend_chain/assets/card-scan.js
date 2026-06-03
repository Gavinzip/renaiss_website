(() => {
  const API_PATH = "/api/card-scan/recognize";
  const MULTI_API_PATH = "/api/card-scan/recognize-cards";
  const SNKR_HISTORY_PATH = "/api/card-scan/snkr-history";
  const RENAISS_MARKET_PATH = "/api/card-scan/renaiss-market";
  const SCAN_TIMEOUT_MS = 110000;
  const SCAN_SLOW_NOTICE_MS = 15000;
  const DEFAULT_QUERY = {
    crop: "true",
    crop_mode: "tcgp_obb",
    top_k: "5",
    language_rerank: "true",
    language_ocr: "true",
    include_debug_crop_base64: "true",
  };
  const MULTI_QUERY = {
    detector: "tcgp_obb",
    max_cards: "20",
    top_k: "5",
    per_index_top_k: "5",
    include_crop_base64: "true",
    sort: "reading_order",
  };
  const RANGE_DAYS = { "1d": 1, "1w": 7, "1m": 31, "1y": 365 };
  const STANDARD_CONDITIONS = [
    ["raw_a", "RAW A"],
    ["raw_b", "RAW B"],
    ["raw_c", "RAW C"],
    ["psa_10", "PSA 10"],
    ["psa_9", "PSA 9"],
    ["psa_8", "PSA 8"],
    ["psa_7", "PSA 7"],
    ["psa_6", "PSA 6"],
    ["psa_5", "PSA 5"],
  ];

  const state = {
    file: null,
    inputUrl: "",
    cropUrl: "",
    referenceUrl: "",
    response: null,
    scanMode: "single",
    multiCards: [],
    selectedCardIndex: 0,
    activeRawResponse: null,
    selectedIndex: 0,
    range: "1y",
    marketSource: "SNKR",
    selectedConditionKey: "",
    snkrHistoryByProduct: {},
    renaissMarketByKey: {},
    chartHoverPoints: [],
    chartSize: { width: 720, height: 260 },
    scanRequestId: 0,
    scanController: null,
    scanTraceId: "",
  };

  const $ = (selector) => document.querySelector(selector);
  const refs = {
    dropzone: $("#card-scan-dropzone"),
    fileInput: $("#card-scan-file"),
    pickButton: $("#card-scan-pick"),
    repickButton: $("#card-scan-repick"),
    uploadCopy: $("#scan-upload-copy"),
    uploadHint: $("#scan-upload-hint"),
    betaToggle: $("#scan-beta-toggle"),
    betaPanel: $("#scan-beta-panel"),
    betaCopy: $("#scan-beta-copy"),
    modeToggle: $("#scan-mode-toggle"),
    resetButton: $("#card-scan-reset"),
    previewStage: $("#scan-preview-stage"),
    previewImg: $("#scan-input-preview"),
    imageTabs: $("#scan-image-tabs"),
    title: $("#scan-result-title"),
    status: $("#card-scan-status"),
    multiStrip: $("#scan-multi-strip"),
    loading: $("#scan-loading"),
    empty: $("#scan-empty-state"),
    detail: $("#scan-card-detail"),
    thumb: $("#scan-card-thumb"),
    score: $("#scan-card-score"),
    name: $("#scan-card-name"),
    meta: $("#scan-card-meta"),
    metrics: $("#scan-market-metrics"),
    diagnostics: $("#scan-diagnostics"),
    actions: $("#scan-result-actions"),
    matches: $("#scan-matches-list"),
    chart: $("#scan-price-chart"),
    chartNote: $("#scan-chart-note"),
    chartTooltip: $("#scan-chart-tooltip"),
    currentPrice: $("#scan-current-price"),
    productId: $("#scan-product-id"),
    rangeRow: $("#scan-range-row"),
    conditionRow: $("#scan-condition-row"),
    sourceTabs: $("#scan-market-source-tabs"),
  };

  function createScanTraceId(mode) {
    const prefix = mode === "multi" ? "multi" : "single";
    const timestamp = Date.now().toString(36);
    let random = "";
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(6);
      window.crypto.getRandomValues(bytes);
      random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    } else {
      random = Math.random().toString(36).slice(2, 10);
    }
    return `scan-${prefix}-${timestamp}-${random}`;
  }

  function setStatus(message, mode = "") {
    refs.status.classList.toggle("is-ok", mode === "ok");
    refs.status.classList.toggle("is-error", mode === "error");
    refs.status.querySelector("span:last-child").textContent = message;
  }

  function setLoading(isLoading) {
    refs.loading.hidden = !isLoading;
    refs.empty.hidden = isLoading || Boolean(state.response);
    refs.resetButton.disabled = !state.file && !state.response;
    refs.dropzone.classList.toggle("is-loading", isLoading);
  }

  function setPreviewMode(hasPreview) {
    refs.dropzone.classList.toggle("has-preview", hasPreview);
    refs.uploadCopy.hidden = hasPreview;
    refs.previewStage.hidden = !hasPreview;
  }

  function setBetaPanel(open) {
    if (!refs.betaToggle || !refs.betaPanel) return;
    refs.betaPanel.hidden = !open;
    refs.betaToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function formatScore(score) {
    const value = Number(score);
    if (!Number.isFinite(value)) return "--";
    return `${Math.round(value * 1000) / 10}% match`;
  }

  function formatPrice(value) {
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) return `US$${Math.round(parsed).toLocaleString()}`;
      return value;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "--";
    return `US$${Math.round(number).toLocaleString()}`;
  }

  function formatDuration(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return "--";
    if (value < 1) return `${Math.round(value * 1000)}ms`;
    return `${value.toFixed(value < 10 ? 2 : 1)}s`;
  }

  function shortDate(raw) {
    const parsed = Date.parse(String(raw || ""));
    if (!Number.isFinite(parsed)) return String(raw || "").slice(0, 10);
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(parsed));
  }

  function currentMatch() {
    const results = Array.isArray(state.response?.results) ? state.response.results : [];
    return results[state.selectedIndex] || results[0] || null;
  }

  function snkrFor(match) {
    return match?.snkr && typeof match.snkr === "object" ? match.snkr : {};
  }

  function productIdFor(match) {
    const snkr = snkrFor(match);
    return String(snkr.product_id || snkr.productId || match?.snkr_product_id || "").trim();
  }

  function cardNumberFor(match) {
    const raw = String(match?.card_number || match?.number || match?.card_id || match?.card_code || "").trim();
    const tokens = raw.match(/[A-Za-z]*\d+[A-Za-z]*/g);
    if (tokens?.length) return tokens[tokens.length - 1].replace(/^0+/, "") || tokens[tokens.length - 1];
    const digits = raw.match(/\d+/g);
    return digits?.length ? (digits[digits.length - 1].replace(/^0+/, "") || digits[digits.length - 1]) : raw;
  }

  function renaissKeyFor(match) {
    return [
      match?.name_en || match?.name || "",
      cardNumberFor(match),
      match?.card_id || match?.card_code || "",
      match?.language || "",
    ].join("|").toLowerCase();
  }

  function renaissFor(match) {
    const key = renaissKeyFor(match);
    return key ? state.renaissMarketByKey[key] : null;
  }

  function bestRenaissListing(match) {
    const data = renaissFor(match);
    const best = data?.best && typeof data.best === "object" ? data.best : null;
    if (best) return best;
    const listings = Array.isArray(data?.listings) ? data.listings : [];
    return listings.find((listing) => listing?.is_listed) || listings[0] || null;
  }

  function bestImageFor(match) {
    return (
      match?.display_image_url
      || match?.reference_image_url
      || match?.image_url
      || state.cropUrl
      || state.inputUrl
      || ""
    );
  }

  function scannedImageFor() {
    return state.cropUrl || state.inputUrl || "";
  }

  function setPreview(kind) {
    const tabs = Array.from(refs.imageTabs.querySelectorAll("[data-scan-image-tab]"));
    const source = kind === "crop" ? state.cropUrl : (kind === "reference" ? state.referenceUrl : state.inputUrl);
    if (!source) return;
    refs.previewImg.src = source;
    tabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.scanImageTab === kind);
    });
  }

  function setImageTabAvailability() {
    const tabs = Array.from(refs.imageTabs.querySelectorAll("[data-scan-image-tab]"));
    tabs.forEach((button) => {
      const key = button.dataset.scanImageTab;
      const hasImage = key === "input" ? state.inputUrl : (key === "crop" ? state.cropUrl : state.referenceUrl);
      button.disabled = !hasImage;
    });
  }

  function responseCropUrl(response) {
    const raw = response?.crop?.debug_crop_jpeg_base64 || response?.crop?.debug_crop_base64 || "";
    if (!raw) return "";
    return raw.startsWith("data:") ? raw : `data:image/jpeg;base64,${raw}`;
  }

  function cropUrlForMultiCard(card) {
    const raw = (
      card?.crop?.jpeg_base64
      || card?.crop?.crop_base64
      || card?.crop?.debug_crop_jpeg_base64
      || card?.crop?.debug_crop_base64
      || ""
    );
    if (!raw) return "";
    return raw.startsWith("data:") ? raw : `data:image/jpeg;base64,${raw}`;
  }

  function multiCardResponse(card, payload) {
    const cropRaw = card?.crop?.jpeg_base64 || card?.crop?.crop_base64 || "";
    const results = Array.isArray(card?.results) ? card.results : [];
    return {
      ok: Boolean(payload?.ok),
      status: results.length ? "ok" : "error",
      results,
      crop: {
        status: payload?.detector || card?.class_name || "multi-card",
        detector: payload?.detector || "",
        fallback_used: false,
        debug_crop_jpeg_base64: cropRaw,
      },
      timings: {
        ...(payload?.timings && typeof payload.timings === "object" ? payload.timings : {}),
        ...(card?.timings && typeof card.timings === "object" ? card.timings : {}),
      },
      input: payload?.input || {},
      _multi_card: card,
      _multi_payload: payload,
    };
  }

  function normalizeMultiCards(payload) {
    const cards = Array.isArray(payload?.cards) ? payload.cards : [];
    return cards.map((card, index) => {
      const response = multiCardResponse(card, payload);
      const best = Array.isArray(card?.results) ? card.results[0] : null;
      return {
        index,
        card,
        response,
        cropUrl: cropUrlForMultiCard(card),
        title: best?.name_en || best?.name || `Card ${index + 1}`,
        score: best?.score,
      };
    });
  }

  function priceValueFor(match) {
    if (state.marketSource === "Renaiss") {
      const listing = bestRenaissListing(match);
      const detailPrice = listing?.detail?.price_usd;
      return detailPrice ?? listing?.ask_usdt ?? listing?.fmv_usd ?? null;
    }
    const snkr = snkrFor(match);
    return snkr.min_price ?? snkr.price ?? match?.marketPriceUsd ?? match?.market_price_usd ?? null;
  }

  function historyFor(match) {
    if (state.marketSource === "Renaiss") {
      return renaissHistoryFor(match, state.range);
    }
    const productId = productIdFor(match);
    const cached = productId ? state.snkrHistoryByProduct[productId] : null;
    const trades = Array.isArray(cached?.trades) ? cached.trades : [];
    if (trades.length) {
      return pricePointsFromTrades(trades, state.range, selectedConditionKey());
    }
    const snkr = snkrFor(match);
    const raw = (
      match?.priceHistory
      || match?.price_history
      || snkr.priceHistory
      || snkr.price_history
      || snkr.history
      || []
    );
    if (!Array.isArray(raw)) return [];
    const cutoff = Date.now() - (RANGE_DAYS[state.range] || 365) * 86400000;
    return raw
      .map((point) => {
        const price = Number(point.price ?? point.price_usd ?? point.value ?? point.close);
        const date = String(point.date ?? point.updated_at ?? point.time ?? point.label ?? "");
        const parsed = Date.parse(date);
        return {
          date,
          parsed: Number.isFinite(parsed) ? parsed : 0,
          label: point.label || shortDate(date),
          price,
        };
      })
      .filter((point) => Number.isFinite(point.price) && point.price > 0)
      .filter((point) => !point.parsed || point.parsed >= cutoff)
      .slice(-260);
  }

  function renaissHistoryFor(match, range) {
    const listing = bestRenaissListing(match);
    const raw = Array.isArray(listing?.detail?.price_history) ? listing.detail.price_history : [];
    if (!raw.length) return [];
    const points = raw
      .map((point) => {
        const price = Number(point.price_usd ?? point.price ?? point.value);
        const date = String(point.date ?? point.timestamp ?? "");
        const parsed = Date.parse(date);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(parsed)) return null;
        return {
          date,
          parsed,
          label: shortDate(date),
          price: Math.round(price),
          sourceCount: 1,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.parsed - right.parsed);
    if (!points.length) return [];
    const latestTime = points[points.length - 1].parsed;
    const cutoff = latestTime - (RANGE_DAYS[range] || 365) * 86400000;
    const ranged = points.filter((point) => point.parsed >= cutoff);
    return ranged.length ? ranged : points.slice(-1);
  }

  function hasAnyHistoryFor(match) {
    if (state.marketSource === "Renaiss") {
      const listing = bestRenaissListing(match);
      return Array.isArray(listing?.detail?.price_history) && listing.detail.price_history.length > 1;
    }
    const productId = productIdFor(match);
    const cached = productId ? state.snkrHistoryByProduct[productId] : null;
    if (Array.isArray(cached?.trades) && cached.trades.length) return true;
    return historyFor(match).length > 1;
  }

  function detectedConditionKey() {
    const text = String(state.response?.slab_barcode?.lookup?.label_ocr?.text || "").toLowerCase();
    if (!text) return "";
    if (text.includes("psa") && (text.includes("gemmt") || text.includes("gem mt") || text.match(/\b10\b/))) {
      return "psa_10";
    }
    const psaMatch = text.match(/psa\s*([0-9](?:\.[0-9])?|10)/i);
    return psaMatch ? `psa_${psaMatch[1]}` : "";
  }

  function detectedSlabSerial() {
    const text = String(state.response?.slab_barcode?.lookup?.label_ocr?.text || "");
    const psaMatch = text.match(/PSA\D{0,24}(\d{7,12})/i);
    if (psaMatch) return psaMatch[1];
    const longNumbers = text.match(/\b\d{7,12}\b/g);
    return longNumbers?.[0] || "";
  }

  function detectedConditionLabel() {
    const key = detectedConditionKey();
    return conditionLabelFor(key);
  }

  function selectedConditionKey() {
    return state.selectedConditionKey || detectedConditionKey() || "raw_a";
  }

  function selectedConditionLabel() {
    return conditionLabelFor(selectedConditionKey());
  }

  function conditionLabelFor(key) {
    if (!key) return "";
    if (key === "psa_10") return "PSA 10";
    if (key.startsWith("psa_")) return `PSA ${key.slice(4)}`;
    if (key.startsWith("raw_")) return key.replace("_", " ").toUpperCase();
    const standard = STANDARD_CONDITIONS.find(([id]) => id === key);
    return standard ? standard[1] : key.replace(/_/g, " ").toUpperCase();
  }

  function normalizeConditionKey(raw) {
    const normalized = String(raw || "").toLowerCase().replace(/[\s_-]/g, "").trim();
    if (!normalized) return "raw_a";
    if (["unknown", "ungraded", "raw", "rawa", "a", "ranka", "conditiona"].includes(normalized)) return "raw_a";
    if (["rawb", "b", "rankb", "conditionb"].includes(normalized)) return "raw_b";
    if (["rawc", "c", "rankc", "conditionc"].includes(normalized)) return "raw_c";
    if (["s", "psa10+", "psa100"].includes(normalized)) return "psa_10";
    if (normalized.startsWith("psa")) {
      const grade = normalized.slice(3).replace(/[^0-9.]/g, "");
      if (grade) return `psa_${grade}`;
    }
    return normalized.replace(/[^a-z0-9.]/g, "");
  }

  function tradePriceUSD(trade) {
    const price = Number(trade?.price_usd ?? trade?.priceUSD);
    if (Number.isFinite(price) && price > 0) return price;
    const raw = Number(trade?.price);
    const format = String(trade?.price_format || trade?.priceFormat || "");
    if (Number.isFinite(raw) && raw > 0 && (format.includes("$") || format.toUpperCase().includes("USD"))) {
      return raw;
    }
    return null;
  }

  function pricePointsFromTrades(rawTrades, range, conditionKey) {
    const cleanTrades = rawTrades
      .map((trade) => {
        const price = tradePriceUSD(trade);
        const date = String(trade?.date || trade?.tradedAt || "");
        const parsed = Date.parse(date);
        if (!price || !Number.isFinite(parsed)) return null;
        return {
          date,
          parsed,
          price,
          condition: String(trade?.condition || "Unknown"),
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.parsed - right.parsed);
    if (!cleanTrades.length) return [];

    const latestTime = cleanTrades[cleanTrades.length - 1].parsed;
    const cutoff = latestTime - (RANGE_DAYS[range] || 365) * 86400000;
    let ranged = cleanTrades.filter((trade) => trade.parsed >= cutoff);
    if (!ranged.length) ranged = cleanTrades.slice(-1);

    if (conditionKey) {
      const conditionTrades = ranged.filter((trade) => normalizeConditionKey(trade.condition) === conditionKey);
      if (conditionTrades.length) ranged = conditionTrades;
    }

    const withoutOutliers = removeIQRPriceOutliers(ranged);
    if (range === "1d") {
      return withoutOutliers.map((trade) => ({
        date: trade.date,
        parsed: trade.parsed,
        label: shortDate(trade.date),
        price: Math.round(trade.price),
        sourceCount: 1,
      }));
    }
    return dailyMedianPoints(withoutOutliers);
  }

  function dailyMedianPoints(trades) {
    const byDay = new Map();
    trades.forEach((trade) => {
      const day = startOfDayIso(trade.date);
      if (!day) return;
      const list = byDay.get(day) || [];
      list.push(trade);
      byDay.set(day, list);
    });
    return Array.from(byDay.entries())
      .map(([date, dayTrades]) => {
        const median = percentile(0.5, dayTrades.map((trade) => trade.price).sort((left, right) => left - right));
        if (!Number.isFinite(median)) return null;
        return {
          date,
          parsed: Date.parse(date),
          label: shortDate(date),
          price: Math.round(median),
          sourceCount: dayTrades.length,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.parsed - right.parsed);
  }

  function removeIQRPriceOutliers(trades) {
    if (trades.length < 8) return trades;
    const prices = trades.map((trade) => trade.price).sort((left, right) => left - right);
    const q1 = percentile(0.25, prices);
    const q3 = percentile(0.75, prices);
    if (!Number.isFinite(q1) || !Number.isFinite(q3)) return trades;
    const iqr = q3 - q1;
    if (iqr <= 0) return trades;
    const min = q1 - 1.5 * iqr;
    const max = q3 + 1.5 * iqr;
    return trades.filter((trade) => trade.price >= min && trade.price <= max);
  }

  function percentile(percentileValue, values) {
    if (!values.length) return undefined;
    const clamped = Math.min(Math.max(percentileValue, 0), 1);
    const position = (values.length - 1) * clamped;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const fraction = position - lowerIndex;
    if (lowerIndex === upperIndex) return values[lowerIndex];
    return values[lowerIndex] * (1 - fraction) + values[upperIndex] * fraction;
  }

  function startOfDayIso(raw) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  function smoothChartPath(coords) {
    if (coords.length <= 2) {
      return coords
        .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
        .join(" ");
    }
    const path = coords.reduce((currentPath, coord, index, all) => {
      if (index === 0) return `M ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`;
      const previous = all[index - 1];
      const midX = (previous.x + coord.x) / 2;
      const midY = (previous.y + coord.y) / 2;
      return `${currentPath} Q ${previous.x.toFixed(1)} ${previous.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
    }, "");
    const last = coords[coords.length - 1];
    return `${path} T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  }

  function chartDefs(width, height) {
    return `
      <defs>
        <linearGradient id="scanChartRainbow" x1="0" x2="1" y1="0" y2="0">
          <stop stop-color="#73fff1"/>
          <stop offset=".22" stop-color="#66a9ff"/>
          <stop offset=".42" stop-color="#9e7cff"/>
          <stop offset=".62" stop-color="#f16cff"/>
          <stop offset=".82" stop-color="#ff789c"/>
          <stop offset="1" stop-color="#e8ff6b"/>
        </linearGradient>
        <linearGradient id="scanChartArea" x1="0" x2="0" y1="0" y2="1">
          <stop stop-color="rgba(115,255,241,.26)"/>
          <stop offset=".36" stop-color="rgba(241,108,255,.13)"/>
          <stop offset=".72" stop-color="rgba(232,255,107,.07)"/>
          <stop offset="1" stop-color="rgba(0,0,0,0)"/>
        </linearGradient>
        <radialGradient id="scanChartPointAura" cx="50%" cy="50%" r="50%">
          <stop stop-color="rgba(232,255,107,.52)"/>
          <stop offset=".42" stop-color="rgba(241,108,255,.2)"/>
          <stop offset="1" stop-color="rgba(115,255,241,0)"/>
        </radialGradient>
        <filter id="scanChartGlow" x="-18%" y="-45%" width="136%" height="190%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.30  0 1 0 0 0.40  0 0 1 0 1  0 0 0 0.52 0" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <clipPath id="scanChartClip">
          <rect x="0" y="0" width="${width}" height="${height}" rx="18" ry="18"/>
        </clipPath>
      </defs>`;
  }

  function chartHoverSvg(width, height) {
    return `
      <g id="scan-chart-hover-layer" class="scan-chart-hover-layer" style="display:none" aria-hidden="true">
        <line id="scan-chart-hover-line" x1="0" y1="14" x2="0" y2="${height - 18}" stroke="rgba(31,58,92,.24)" stroke-width="1.2"/>
        <circle id="scan-chart-hover-aura" cx="0" cy="0" r="16" fill="url(#scanChartPointAura)" opacity=".78"/>
        <circle id="scan-chart-hover-ring" cx="0" cy="0" r="7" fill="rgba(255,255,255,.86)" stroke="url(#scanChartRainbow)" stroke-width="2.2"/>
        <circle id="scan-chart-hover-dot" cx="0" cy="0" r="2.7" fill="#173454"/>
      </g>
      <rect class="scan-chart-hit-area" x="0" y="0" width="${width}" height="${height}" fill="transparent" pointer-events="all"/>`;
  }

  function chartGrid(width, height, pad, innerH) {
    const horizontal = [0.22, 0.5, 0.78].map((ratio) => {
      const y = pad.top + innerH * ratio;
      return `<line x1="0" y1="${y.toFixed(1)}" x2="${width}" y2="${y.toFixed(1)}" stroke="rgba(72,106,139,.14)" stroke-width="1"/>`;
    });
    const vertical = Array.from({ length: 9 }, (_, index) => {
      const x = pad.left + ((width - pad.left - pad.right) * index) / 8;
      return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${height}" stroke="rgba(72,106,139,.09)" stroke-width="1"/>`;
    });
    return `<g opacity=".9">${horizontal.join("")}${vertical.join("")}</g>`;
  }

  function chartDimensions() {
    const rect = refs.chart?.getBoundingClientRect?.();
    const parentRect = refs.chart?.parentElement?.getBoundingClientRect?.();
    const measuredWidth = Number(rect?.width || parentRect?.width || 0);
    const measuredHeight = Number(rect?.height || 0);
    const width = Math.max(280, Math.round(measuredWidth || 720));
    const compact = width < 520;
    const fallbackHeight = compact ? 210 : 260;
    const height = Math.max(compact ? 180 : 220, Math.round(measuredHeight || fallbackHeight));
    const pad = compact
      ? { left: 26, right: 18, top: 24, bottom: 32 }
      : { left: 44, right: 28, top: 30, bottom: 42 };
    return { width, height, pad, compact };
  }

  function drawChart(points, currentPrice) {
    const { width, height, pad, compact } = chartDimensions();
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const price = Number(currentPrice);
    const axisFont = compact ? 11 : 14;
    const bottomFont = compact ? 11 : 15;
    const markerFont = compact ? 15 : 21;
    const emptyFont = compact ? 14 : 19;
    const glowStroke = compact ? 7 : 10;
    const softStroke = compact ? 3.6 : 4.6;
    const lineStroke = compact ? 2 : 2.2;
    state.chartHoverPoints = [];
    state.chartSize = { width, height };
    hideChartHover();
    refs.chart.innerHTML = "";
    refs.chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    refs.chart.setAttribute("preserveAspectRatio", "xMidYMid meet");

    refs.chart.insertAdjacentHTML(
      "beforeend",
      `${chartDefs(width, height)}
       ${chartGrid(width, height, pad, innerH)}`
    );

    if (points.length < 2) {
      const markerPrice = Number.isFinite(price) && price > 0 ? price : null;
      if (markerPrice) {
        const y = pad.top + innerH * 0.48;
        const lineEnd = width - pad.right - 18;
        state.chartHoverPoints = [{
          x: lineEnd,
          y,
          point: {
            label: "Live floor",
            price: markerPrice,
            sourceCount: 0,
          },
        }];
        const signal = [
          `M ${pad.left} ${y.toFixed(1)}`,
          `Q ${(pad.left + innerW * 0.12).toFixed(1)} ${(y - 12).toFixed(1)} ${(pad.left + innerW * 0.23).toFixed(1)} ${(y - 1).toFixed(1)}`,
          `T ${(pad.left + innerW * 0.42).toFixed(1)} ${(y - 4).toFixed(1)}`,
          `T ${(pad.left + innerW * 0.62).toFixed(1)} ${(y + 8).toFixed(1)}`,
          `T ${(pad.left + innerW * 0.82).toFixed(1)} ${(y - 6).toFixed(1)}`,
          `T ${lineEnd.toFixed(1)} ${y.toFixed(1)}`,
        ].join(" ");
        refs.chart.insertAdjacentHTML(
          "beforeend",
          `<g clip-path="url(#scanChartClip)">
             <path d="${signal}" fill="none" stroke="url(#scanChartRainbow)" stroke-width="${glowStroke}" stroke-linecap="round" stroke-linejoin="round" opacity=".30" filter="url(#scanChartGlow)"/>
             <path d="${signal}" fill="none" stroke="url(#scanChartRainbow)" stroke-width="${softStroke}" stroke-linecap="round" stroke-linejoin="round" opacity=".56" filter="url(#scanChartGlow)"/>
             <path d="${signal}" fill="none" stroke="url(#scanChartRainbow)" stroke-width="${lineStroke}" stroke-linecap="round" stroke-linejoin="round"/>
             <circle cx="${lineEnd}" cy="${y}" r="15" fill="url(#scanChartPointAura)" opacity=".7"/>
             <circle cx="${lineEnd}" cy="${y}" r="5.2" fill="#f7ff7c"/>
             <circle cx="${lineEnd}" cy="${y}" r="2.2" fill="#ffffff"/>
             <text x="${pad.left}" y="${y - 18}" fill="#173454" font-size="${markerFont}" font-weight="900">${escapeHtml(formatPrice(markerPrice))}</text>
             <text x="${width - pad.right}" y="${height - 14}" text-anchor="end" fill="rgba(54,78,105,.58)" font-size="${axisFont}" font-weight="800">live floor</text>
           </g>
           ${chartHoverSvg(width, height)}`
        );
        refs.chartNote.textContent = state.marketSource === "Renaiss"
          ? "Renaiss 目前只有即時價格或不足兩個歷史點；彩色線只代表目前價格，不代表完整歷史走勢。"
          : "SNKRDUNK 目前只有即時地板價或不足兩個歷史點；彩色線只代表目前地板價，不代表完整歷史走勢。";
      } else {
        refs.chart.insertAdjacentHTML(
          "beforeend",
          `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="rgba(54,78,105,.64)" font-size="${emptyFont}" font-weight="800">No market price returned yet</text>`
        );
        refs.chartNote.textContent = "這張卡目前沒有可用的價格資料。";
      }
      return;
    }

    const min = Math.min(...points.map((p) => p.price));
    const max = Math.max(...points.map((p) => p.price));
    const rawSpan = Math.max(1, max - min);
    const domainMin = Math.max(0, min - rawSpan * 0.18);
    const domainMax = max + rawSpan * 0.18;
    const span = Math.max(1, domainMax - domainMin);
    const coords = points.map((point, index) => {
      const x = pad.left + (innerW * index) / Math.max(1, points.length - 1);
      const y = pad.top + innerH - ((point.price - domainMin) / span) * innerH;
      return { x, y, point };
    });
    state.chartHoverPoints = coords;
    const line = smoothChartPath(coords);
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${pad.top + innerH} L ${coords[0].x.toFixed(1)} ${pad.top + innerH} Z`;
    const latest = coords[coords.length - 1];
    refs.chart.insertAdjacentHTML(
      "beforeend",
      `<g clip-path="url(#scanChartClip)">
        <path d="${area}" fill="url(#scanChartArea)" opacity=".72"/>
        <path d="${area}" fill="url(#scanChartRainbow)" opacity=".07"/>
        <path d="${line}" fill="none" stroke="url(#scanChartRainbow)" stroke-width="${compact ? 3.2 : 4}" stroke-linecap="round" stroke-linejoin="round" opacity=".36" filter="url(#scanChartGlow)"/>
        <path d="${line}" fill="none" stroke="url(#scanChartRainbow)" stroke-width="${lineStroke}" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="0" y1="${latest.y.toFixed(1)}" x2="${width}" y2="${latest.y.toFixed(1)}" stroke="rgba(54,78,105,.14)" stroke-width="1"/>
        <circle cx="${latest.x.toFixed(1)}" cy="${latest.y.toFixed(1)}" r="13" fill="url(#scanChartPointAura)" opacity=".74"/>
        <circle cx="${latest.x.toFixed(1)}" cy="${latest.y.toFixed(1)}" r="5" fill="#f7ff7c"/>
        <circle cx="${latest.x.toFixed(1)}" cy="${latest.y.toFixed(1)}" r="2.1" fill="#ffffff"/>
        <text x="${pad.left}" y="${height - 13}" fill="rgba(54,78,105,.62)" font-size="${bottomFont}" font-weight="800">${escapeHtml(coords[0].point.label)}</text>
        <text x="${width - pad.right}" y="${height - 13}" text-anchor="end" fill="rgba(54,78,105,.62)" font-size="${bottomFont}" font-weight="800">${escapeHtml(coords[coords.length - 1].point.label)}</text>
        <text x="${width - pad.right}" y="${pad.top + 13}" text-anchor="end" fill="rgba(54,78,105,.56)" font-size="${axisFont}" font-weight="800">${escapeHtml(formatPrice(max))}</text>
        <text x="${width - pad.right}" y="${height - pad.bottom - 2}" text-anchor="end" fill="rgba(54,78,105,.44)" font-size="${axisFont}" font-weight="800">${escapeHtml(formatPrice(min))}</text>
      </g>
      ${chartHoverSvg(width, height)}`
    );
    refs.chartNote.textContent = `${points.length} price points · latest ${formatPrice(points[points.length - 1].price)}`;
  }

  function nearestChartPoint(clientX) {
    const points = state.chartHoverPoints;
    if (!points.length) return null;
    const rect = refs.chart.getBoundingClientRect();
    if (!rect.width) return points[points.length - 1];
    const chartX = ((clientX - rect.left) / rect.width) * state.chartSize.width;
    return points.reduce((nearest, point) => (
      Math.abs(point.x - chartX) < Math.abs(nearest.x - chartX) ? point : nearest
    ), points[0]);
  }

  function showChartHover(point) {
    if (!point) return;
    const layer = refs.chart.querySelector("#scan-chart-hover-layer");
    const line = refs.chart.querySelector("#scan-chart-hover-line");
    const aura = refs.chart.querySelector("#scan-chart-hover-aura");
    const ring = refs.chart.querySelector("#scan-chart-hover-ring");
    const dot = refs.chart.querySelector("#scan-chart-hover-dot");
    if (!layer || !line || !aura || !ring || !dot) return;

    layer.style.display = "";
    line.setAttribute("x1", point.x.toFixed(1));
    line.setAttribute("x2", point.x.toFixed(1));
    [aura, ring, dot].forEach((node) => {
      node.setAttribute("cx", point.x.toFixed(1));
      node.setAttribute("cy", point.y.toFixed(1));
    });

    const chartRect = refs.chart.getBoundingClientRect();
    const wrapRect = refs.chart.parentElement.getBoundingClientRect();
    const left = (point.x / state.chartSize.width) * chartRect.width + chartRect.left - wrapRect.left;
    const top = (point.y / state.chartSize.height) * chartRect.height + chartRect.top - wrapRect.top;
    const clampedLeft = Math.max(78, Math.min(wrapRect.width - 78, left));
    const clampedTop = Math.max(18, top);
    const sourceCount = Number(point.point?.sourceCount);
    const sourceLabel = Number.isFinite(sourceCount) && sourceCount > 1 ? `${sourceCount} trades` : "";
    refs.chartTooltip.hidden = false;
    refs.chartTooltip.style.left = `${clampedLeft}px`;
    refs.chartTooltip.style.top = `${clampedTop}px`;
    refs.chartTooltip.innerHTML = `
      <span>${escapeHtml(point.point?.label || shortDate(point.point?.date) || "Price")}</span>
      <strong>${escapeHtml(formatPrice(point.point?.price))}</strong>
      ${sourceLabel ? `<em>${escapeHtml(sourceLabel)}</em>` : ""}
    `;
  }

  function hideChartHover() {
    const layer = refs.chart?.querySelector("#scan-chart-hover-layer");
    if (layer) layer.style.display = "none";
    if (refs.chartTooltip) {
      refs.chartTooltip.hidden = true;
      refs.chartTooltip.innerHTML = "";
    }
  }

  function handleChartPointerMove(event) {
    if (!state.chartHoverPoints.length) return;
    showChartHover(nearestChartPoint(event.clientX));
  }

  function renderMatches() {
    const results = Array.isArray(state.response?.results) ? state.response.results : [];
    if (!results.length) {
      refs.matches.innerHTML = `<div class="scan-match-empty">沒有候選結果。</div>`;
      return;
    }
    refs.matches.innerHTML = results.map((match, index) => {
      const meta = [match.index, match.set_id, match.card_id || match.card_code, match.language].filter(Boolean).join(" · ");
      return `
        <button class="scan-match-card ${index === state.selectedIndex ? "is-active" : ""}" type="button" data-match-index="${index}">
          <img src="${escapeAttr(bestImageFor(match))}" alt="" loading="lazy" />
          <span>
            <span class="scan-match-name">${escapeHtml(match.name_en || match.name || "Unknown card")}</span>
            <span class="scan-match-meta">${escapeHtml(meta || "Candidate")}</span>
          </span>
          <span class="scan-match-score">${escapeHtml(formatScore(match.score))}</span>
        </button>
      `;
    }).join("");
  }

  async function loadSNKRHistory(match) {
    const productId = productIdFor(match);
    if (!productId) return;
    const existing = state.snkrHistoryByProduct[productId];
    if (existing?.status === "loading" || existing?.status === "loaded") return;
    state.snkrHistoryByProduct[productId] = { status: "loading", trades: [] };
    refs.rangeRow.hidden = false;
    refs.rangeRow.querySelectorAll("[data-range]").forEach((button) => {
      button.disabled = true;
    });
    refs.chartNote.textContent = "正在讀取 SNKRDUNK 交易歷史，載入後 1D / 1W / 1M / 1Y 會直接切換。";
    try {
      const response = await fetch(`${SNKR_HISTORY_PATH}?product_id=${encodeURIComponent(productId)}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `SNKRDUNK history failed: HTTP ${response.status}`);
      }
      const trades = Array.isArray(payload.trades) ? payload.trades : [];
      state.snkrHistoryByProduct[productId] = {
        status: "loaded",
        trades,
        tradeCount: payload.trade_count ?? trades.length,
      };
    } catch (error) {
      state.snkrHistoryByProduct[productId] = {
        status: "error",
        trades: [],
        error: error?.message || String(error),
      };
    }
    const current = currentMatch();
    if (productIdFor(current) === productId) {
      renderDetail();
    }
  }

  async function loadRenaissMarket(match) {
    const key = renaissKeyFor(match);
    if (!key) return;
    const existing = state.renaissMarketByKey[key];
    if (existing?.status === "loading" || existing?.status === "loaded") return;
    state.renaissMarketByKey[key] = { status: "loading", listings: [] };
    updateSourceTabs(match);
    try {
      const params = new URLSearchParams({
        name: match?.name_en || match?.name || "",
        number: cardNumberFor(match),
        card_code: match?.card_id || match?.card_code || "",
        set_id: match?.set_id || "",
        language: match?.language || "",
        serial: detectedSlabSerial(),
        limit: "24",
      });
      const response = await fetch(`${RENAISS_MARKET_PATH}?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Renaiss marketplace failed: HTTP ${response.status}`);
      }
      state.renaissMarketByKey[key] = {
        status: "loaded",
        listings: Array.isArray(payload.listings) ? payload.listings : [],
        best: payload.best || null,
      };
    } catch (error) {
      state.renaissMarketByKey[key] = {
        status: "error",
        listings: [],
        error: error?.message || String(error),
      };
    }
    if (renaissKeyFor(currentMatch()) === key) {
      renderDetail();
    }
  }

  function updateSourceTabs(match) {
    const hasSNKR = Boolean(productIdFor(match));
    const data = renaissFor(match);
    const hasRenaiss = data?.status === "loading" || data?.status === "loaded" || data?.status === "error";
    refs.sourceTabs.hidden = !(hasSNKR && hasRenaiss);
    refs.sourceTabs.querySelectorAll("[data-market-source]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.marketSource === state.marketSource);
    });
  }

  function renderRangeControls(match, history) {
    const productId = productIdFor(match);
    const cached = productId ? state.snkrHistoryByProduct[productId] : null;
    const hasHistory = history.length > 1 || hasAnyHistoryFor(match);
    refs.rangeRow.hidden = !(productId || hasHistory || state.marketSource === "Renaiss");
    refs.rangeRow.querySelectorAll("[data-range]").forEach((button) => {
      const loadingSNKR = state.marketSource === "SNKR" && productId && (!cached || cached.status === "loading" || cached.status === "error") && !hasHistory;
      const loadingRenaiss = state.marketSource === "Renaiss" && renaissFor(match)?.status === "loading";
      button.disabled = Boolean(loadingSNKR || loadingRenaiss);
      button.classList.toggle("is-active", button.dataset.range === state.range);
    });
    updateSourceTabs(match);
  }

  function conditionOptionsFromTrades(trades) {
    const counts = new Map();
    trades.forEach((trade) => {
      const key = normalizeConditionKey(trade?.condition || "");
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const standardIds = new Set(STANDARD_CONDITIONS.map(([id]) => id));
    const standard = STANDARD_CONDITIONS.map(([id, label]) => ({ id, label, count: counts.get(id) || 0 }));
    const extras = Array.from(counts.entries())
      .filter(([id]) => !standardIds.has(id))
      .sort((left, right) => right[1] - left[1])
      .map(([id, count]) => ({ id, label: conditionLabelFor(id), count }));
    return standard.concat(extras);
  }

  function renderConditionControls(match) {
    if (state.marketSource !== "SNKR") {
      refs.conditionRow.hidden = true;
      refs.conditionRow.innerHTML = "";
      return;
    }
    const productId = productIdFor(match);
    const cached = productId ? state.snkrHistoryByProduct[productId] : null;
    const trades = Array.isArray(cached?.trades) ? cached.trades : [];
    if (!trades.length) {
      refs.conditionRow.hidden = true;
      refs.conditionRow.innerHTML = "";
      return;
    }
    const active = selectedConditionKey();
    refs.conditionRow.hidden = false;
    refs.conditionRow.innerHTML = conditionOptionsFromTrades(trades).map((option) => `
      <button type="button" class="${option.id === active ? "is-active" : ""}" data-condition="${escapeAttr(option.id)}">
        ${escapeHtml(option.label)}<span>${option.count}</span>
      </button>
    `).join("");
  }

  function renderDiagnostics() {
    const timings = state.response?.timings && typeof state.response.timings === "object" ? state.response.timings : {};
    const crop = state.response?.crop && typeof state.response.crop === "object" ? state.response.crop : {};
    const multiCard = state.response?._multi_card;
    const rows = [
      multiCard ? ["Card", `${state.selectedCardIndex + 1}/${state.multiCards.length}`] : null,
      ["Total", formatDuration(timings.total_seconds)],
      ["Crop", formatDuration(timings.crop_seconds)],
      ["Detect", formatDuration(timings.detect_seconds)],
      ["OCR", formatDuration(timings.slab_barcode_seconds)],
      ["Embed", formatDuration(timings.embedding_seconds)],
      ["Search", formatDuration(timings.search_seconds)],
      ["Lang", formatDuration(timings.language_rerank_seconds)],
      ["Cropper", crop.detector || crop.status || "--"],
      ["Fallback", crop.fallback_used ? "Yes" : "No"],
    ].filter(Boolean).filter(([, value]) => value && value !== "--");

    if (!rows.length) {
      refs.diagnostics.hidden = true;
      refs.diagnostics.innerHTML = "";
      return;
    }

    refs.diagnostics.hidden = false;
    refs.diagnostics.innerHTML = rows.map(([label, value]) => `
      <div class="scan-diagnostic">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
      </div>
    `).join("");
  }

  function renderMultiStrip() {
    const cards = state.multiCards;
    if (!cards.length) {
      refs.multiStrip.hidden = true;
      refs.multiStrip.innerHTML = "";
      return;
    }
    refs.multiStrip.hidden = false;
    refs.multiStrip.innerHTML = `
      <div class="scan-multi-label">
        <iconify-icon icon="lucide:scan-search"></iconify-icon>
        <span>已偵測 ${cards.length} 張卡，切換目前查看的卡片。</span>
      </div>
      <div class="scan-multi-list">
        ${cards.map((item, index) => {
          const active = index === state.selectedCardIndex;
          const best = Array.isArray(item.response?.results) ? item.response.results[0] : null;
          const meta = [best?.set_id, best?.card_id || best?.card_code, best?.language].filter(Boolean).join(" · ");
          return `
            <button class="scan-multi-card ${active ? "is-active" : ""}" type="button" data-scan-card-index="${index}">
              <span class="scan-multi-thumb">
                ${item.cropUrl ? `<img src="${escapeAttr(item.cropUrl)}" alt="" loading="lazy" />` : `<iconify-icon icon="lucide:badge-question-mark"></iconify-icon>`}
              </span>
              <span class="scan-multi-copy">
                <span class="scan-multi-count">Card ${index + 1} / ${cards.length}</span>
                <strong>${escapeHtml(item.title || `Card ${index + 1}`)}</strong>
                <em>${escapeHtml(meta || formatScore(item.score))}</em>
              </span>
              <span class="scan-multi-score">${escapeHtml(formatScore(item.score))}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
    updateMultiStripSelection();
  }

  function updateMultiStripSelection() {
    refs.multiStrip.querySelectorAll("[data-scan-card-index]").forEach((button) => {
      const active = Number(button.dataset.scanCardIndex) === state.selectedCardIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderMultiResponse(payload) {
    state.activeRawResponse = payload;
    state.multiCards = normalizeMultiCards(payload);
    state.selectedCardIndex = 0;
    setLoading(false);

    if (!state.multiCards.length) {
      refs.multiStrip.hidden = true;
      refs.multiStrip.innerHTML = "";
      refs.empty.hidden = false;
      refs.detail.hidden = true;
      refs.title.textContent = "沒有偵測到卡片";
      refs.diagnostics.hidden = true;
      refs.diagnostics.innerHTML = "";
      refs.matches.innerHTML = `<div class="scan-match-empty">沒有偵測到卡片。</div>`;
      refs.currentPrice.textContent = "--";
      refs.productId.textContent = "--";
      refs.rangeRow.hidden = true;
      refs.conditionRow.hidden = true;
      refs.sourceTabs.hidden = true;
      setStatus(payload?.error || "沒有偵測到可切換的卡片。", "error");
      drawChart([], null);
      return;
    }

    setStatus(`卡冊辨識完成：已偵測 ${state.multiCards.length} 張卡。`, "ok");
    renderMultiStrip();
    selectMultiCard(0);
  }

  function selectMultiCard(index) {
    const item = state.multiCards[index];
    if (!item) return;
    state.selectedCardIndex = index;
    state.response = item.response;
    state.selectedIndex = 0;
    state.marketSource = "SNKR";
    state.selectedConditionKey = "";
    state.cropUrl = item.cropUrl || "";
    const first = currentMatch();
    state.referenceUrl = first ? bestImageFor(first) : "";
    setImageTabAvailability();
    setPreview(state.cropUrl ? "crop" : "input");
    updateMultiStripSelection();
    if (first) {
      setStatus(`卡冊 ${index + 1}/${state.multiCards.length}：${first.name_en || first.name || "card"}。`, "ok");
      renderDetail();
    } else {
      refs.title.textContent = `Card ${index + 1}`;
      setStatus(`卡冊 ${index + 1}/${state.multiCards.length}：這張卡沒有候選結果。`, "error");
      refs.empty.hidden = false;
      refs.detail.hidden = true;
      refs.diagnostics.hidden = true;
      refs.diagnostics.innerHTML = "";
      refs.matches.innerHTML = `<div class="scan-match-empty">這張卡沒有候選結果。</div>`;
      refs.currentPrice.textContent = "--";
      refs.productId.textContent = "--";
      refs.rangeRow.hidden = true;
      refs.conditionRow.hidden = true;
      refs.sourceTabs.hidden = true;
      drawChart([], null);
    }
  }

  function renderDetail() {
    const match = currentMatch();
    if (!match) return;
    const snkr = snkrFor(match);
    const snkrPrice = snkr.min_price ?? snkr.price ?? match?.marketPriceUsd ?? match?.market_price_usd ?? null;
    const renaissData = renaissFor(match);
    const renaissListing = bestRenaissListing(match);
    const renaissPrice = renaissListing?.detail?.price_usd ?? renaissListing?.ask_usdt ?? renaissListing?.fmv_usd ?? null;
    const price = priceValueFor(match);
    const history = historyFor(match);
    state.referenceUrl = bestImageFor(match);
    setImageTabAvailability();

    refs.empty.hidden = true;
    refs.detail.hidden = false;
    refs.title.textContent = match.name_en || match.name || "Card recognized";
    refs.thumb.src = scannedImageFor() || bestImageFor(match);
    refs.thumb.alt = match.name_en || match.name || "Recognized card";
    refs.score.textContent = formatScore(match.score);
    refs.name.textContent = match.name_en || match.name || "Unknown card";
    refs.meta.textContent = [
      match.game_family || match.game,
      match.set_id,
      match.card_id || match.card_code,
      match.language,
      match.rarity,
    ].filter(Boolean).join(" · ") || "Card metadata unavailable";
    refs.metrics.innerHTML = [
      ["Index", match.index || "--"],
      ["SNKR floor", formatPrice(snkrPrice)],
      ["Renaiss ask", renaissData?.status === "loading" ? "Loading" : formatPrice(renaissPrice)],
      ["Grade", state.marketSource === "SNKR" ? selectedConditionLabel() : ([renaissListing?.grading_company, renaissListing?.grade].filter(Boolean).join(" ") || "--")],
      ["Crop", state.response?.crop?.status || "--"],
    ].map(([label, value]) => `
      <div class="scan-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>
    `).join("");
    renderDiagnostics();
    refs.actions.innerHTML = [
      snkr.url ? `<a href="${escapeAttr(snkr.url)}" target="_blank" rel="noreferrer">Open SNKR</a>` : "",
      renaissListing?.url ? `<a href="${escapeAttr(renaissListing.url)}" target="_blank" rel="noreferrer">Open Renaiss</a>` : "",
      match.display_image_url ? `<a href="${escapeAttr(match.display_image_url)}" target="_blank" rel="noreferrer">Reference image</a>` : "",
    ].filter(Boolean).join("");
    refs.currentPrice.textContent = formatPrice(price);
    refs.productId.textContent = state.marketSource === "Renaiss"
      ? (renaissListing?.token_id ? `R-${String(renaissListing.token_id).slice(-6)}` : "Renaiss")
      : (snkr.product_id || match.canonical_id || "--");
    drawChart(history, price);
    renderRangeControls(match, history);
    renderConditionControls(match);
    const productId = productIdFor(match);
    const cached = productId ? state.snkrHistoryByProduct[productId] : null;
    if (state.marketSource === "Renaiss" && renaissData?.status === "loading") {
      refs.chartNote.textContent = "正在讀取 Renaiss marketplace 價格與歷史。";
    } else if (state.marketSource === "Renaiss" && renaissData?.status === "loaded" && renaissListing) {
      refs.chartNote.textContent = [
        `${history.length} chart points`,
        "Renaiss marketplace",
        state.range.toUpperCase(),
      ].filter(Boolean).join(" · ");
    } else if (state.marketSource === "Renaiss" && renaissData?.status === "error") {
      refs.chartNote.textContent = `Renaiss marketplace 暫時讀不到：${renaissData.error}`;
    } else if (cached?.status === "loading") {
      refs.chartNote.textContent = "正在讀取 SNKRDUNK 交易歷史，載入後 1D / 1W / 1M / 1Y 會直接切換。";
    } else if (cached?.status === "loaded" && Array.isArray(cached.trades) && cached.trades.length) {
      const condition = selectedConditionLabel();
      refs.chartNote.textContent = [
        condition,
        `${history.length} chart points`,
        `${cached.trades.length} SNKRDUNK trades`,
        state.range.toUpperCase(),
      ].filter(Boolean).join(" · ");
    } else if (cached?.status === "error") {
      refs.chartNote.textContent = `SNKRDUNK 交易歷史暫時讀不到：${cached.error}`;
    }
    renderMatches();
    if (productId && !cached) {
      void loadSNKRHistory(match);
    }
    if (!renaissData) {
      void loadRenaissMarket(match);
    }
  }

  function renderResponse(response) {
    state.response = response;
    state.selectedIndex = 0;
    state.marketSource = "SNKR";
    state.selectedConditionKey = "";
    state.cropUrl = responseCropUrl(response);
    const first = currentMatch();
    state.referenceUrl = first ? bestImageFor(first) : "";
    setImageTabAvailability();
    setPreview(state.cropUrl ? "crop" : "input");
    setLoading(false);
    if (response?.status === "ok" && first) {
      setStatus(`辨識完成：${first.name_en || first.name || "card"}。`, "ok");
      renderDetail();
    } else {
      const hasResults = Array.isArray(response?.results) && response.results.length > 0;
      refs.title.textContent = hasResults ? "辨識失敗" : "沒有辨識結果";
      setStatus(response?.error || "模型有回應，但沒有候選結果。", "error");
      refs.empty.hidden = false;
      refs.detail.hidden = true;
      refs.diagnostics.hidden = true;
      refs.diagnostics.innerHTML = "";
      refs.matches.innerHTML = `<div class="scan-match-empty">沒有候選結果。</div>`;
      refs.conditionRow.hidden = true;
      drawChart([], null);
    }
  }

  async function recognize(file) {
    if (!file) return;
    if (state.scanController) {
      state.scanController.abort();
    }
    const requestId = state.scanRequestId + 1;
    state.scanRequestId = requestId;
    const isMultiScan = state.scanMode === "multi";
    const traceId = createScanTraceId(isMultiScan ? "multi" : "single");
    state.scanTraceId = traceId;
    state.file = file;
    state.response = null;
    state.multiCards = [];
    state.selectedCardIndex = 0;
    state.activeRawResponse = null;
    state.selectedIndex = 0;
    state.marketSource = "SNKR";
    state.selectedConditionKey = "";
    if (state.inputUrl) URL.revokeObjectURL(state.inputUrl);
    state.inputUrl = URL.createObjectURL(file);
    state.cropUrl = "";
    state.referenceUrl = "";
    setPreviewMode(true);
    setImageTabAvailability();
    setPreview("input");
    refs.detail.hidden = true;
    refs.diagnostics.hidden = true;
    refs.diagnostics.innerHTML = "";
    refs.empty.hidden = true;
    refs.title.textContent = "辨識中";
    refs.multiStrip.hidden = true;
    refs.multiStrip.innerHTML = "";
    refs.matches.innerHTML = `<div class="scan-match-empty">${isMultiScan ? "等待卡冊模型回傳..." : "等待模型回傳..."}</div>`;
    refs.currentPrice.textContent = "--";
    refs.productId.textContent = "--";
    refs.rangeRow.hidden = true;
    refs.conditionRow.hidden = true;
    refs.sourceTabs.hidden = true;
    drawChart([], null);
    setStatus(`${isMultiScan ? "正在讀取卡冊照片，偵測畫面中的卡片並逐張辨識。" : "正在上傳圖片並辨識。"} 追蹤碼：${traceId}`);
    setLoading(true);

    const form = new FormData();
    form.append("file", file, file.name || "card-image.jpg");
    const params = new URLSearchParams(isMultiScan ? MULTI_QUERY : DEFAULT_QUERY);
    const apiPath = isMultiScan ? MULTI_API_PATH : API_PATH;
    const controller = new AbortController();
    state.scanController = controller;
    const timeout = window.setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
    const slowNotice = window.setTimeout(() => {
      if (requestId !== state.scanRequestId) return;
      setStatus(`辨識時間較長，仍在等待回應；若逾時會自動停止。追蹤碼：${traceId}`);
      refs.matches.innerHTML = `<div class="scan-match-empty">${isMultiScan ? "仍在等待卡冊模型回傳..." : "仍在等待模型回傳..."}</div>`;
    }, SCAN_SLOW_NOTICE_MS);
    try {
      const response = await fetch(`${apiPath}?${params.toString()}`, {
        method: "POST",
        body: form,
        headers: {
          Accept: "application/json",
          "X-Renaiss-Scan-Id": traceId,
        },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (requestId !== state.scanRequestId) return;
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Card scan failed: HTTP ${response.status}`);
      }
      if (isMultiScan) {
        renderMultiResponse(payload);
      } else {
        renderResponse(payload);
      }
    } catch (error) {
      if (requestId !== state.scanRequestId) return;
      setLoading(false);
      refs.empty.hidden = false;
      refs.detail.hidden = true;
      refs.diagnostics.hidden = true;
      refs.diagnostics.innerHTML = "";
      refs.multiStrip.hidden = true;
      refs.multiStrip.innerHTML = "";
      const message =
        error?.name === "AbortError"
          ? `網站代理逾時，請再試一次。追蹤碼：${traceId}`
          : `${String(error?.message || error)} 追蹤碼：${traceId}`;
      refs.title.textContent = error?.name === "AbortError" ? "辨識逾時" : "辨識失敗";
      refs.matches.innerHTML = `<div class="scan-match-empty">${escapeHtml(message)}</div>`;
      setStatus(message, "error");
    } finally {
      window.clearTimeout(timeout);
      window.clearTimeout(slowNotice);
      if (state.scanController === controller) {
        state.scanController = null;
      }
    }
  }

  function reset() {
    state.scanRequestId += 1;
    if (state.scanController) {
      state.scanController.abort();
      state.scanController = null;
    }
    if (state.inputUrl) URL.revokeObjectURL(state.inputUrl);
    state.file = null;
    state.inputUrl = "";
    state.cropUrl = "";
    state.referenceUrl = "";
    state.response = null;
    state.multiCards = [];
    state.selectedCardIndex = 0;
    state.activeRawResponse = null;
    state.selectedIndex = 0;
    state.marketSource = "SNKR";
    state.selectedConditionKey = "";
    setPreviewMode(false);
    refs.fileInput.value = "";
    refs.detail.hidden = true;
    refs.multiStrip.hidden = true;
    refs.multiStrip.innerHTML = "";
    refs.diagnostics.hidden = true;
    refs.diagnostics.innerHTML = "";
    refs.empty.hidden = false;
    refs.title.textContent = "等待卡片";
    refs.matches.innerHTML = `<div class="scan-match-empty">尚未掃描。</div>`;
    refs.currentPrice.textContent = "--";
    refs.productId.textContent = "--";
    refs.rangeRow.hidden = true;
    refs.conditionRow.hidden = true;
    refs.sourceTabs.hidden = true;
    setLoading(false);
    setStatus("選一張卡片開始辨識。");
    drawChart([], null);
  }

  function setScanMode(mode, options = {}) {
    const shouldRescan = Boolean(options.rescan);
    const force = Boolean(options.force);
    const nextMode = mode === "multi" ? "multi" : "single";
    if (state.scanMode === nextMode && !force) return;
    state.scanMode = nextMode;
    refs.modeToggle?.querySelectorAll("[data-scan-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.scanMode === nextMode);
      button.setAttribute("aria-pressed", button.dataset.scanMode === nextMode ? "true" : "false");
    });
    if (refs.uploadHint) {
      refs.uploadHint.textContent = "支援 PSA slab、單張卡、手機拍照。電腦版會在左側保留圖片，右側顯示辨識與價格資訊。";
    }
    if (refs.betaCopy) {
      refs.betaCopy.textContent = nextMode === "multi"
        ? "已啟用卡冊模式。請上傳一張卡冊頁或合照照片，系統會從同一張照片裡逐張建立結果與價格圖。"
        : "上傳一張卡冊頁或合照照片，系統會從同一張照片裡偵測多張卡，再逐張切換候選結果與價格圖。";
    }
    if (state.file && shouldRescan && refs.loading.hidden) {
      void recognize(state.file);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  refs.pickButton.addEventListener("click", () => refs.fileInput.click());
  refs.repickButton.addEventListener("click", () => refs.fileInput.click());
  refs.betaToggle?.addEventListener("click", () => {
    setBetaPanel(refs.betaPanel.hidden);
  });
  refs.modeToggle?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scan-mode]");
    if (!button) return;
    setBetaPanel(true);
    setScanMode(button.dataset.scanMode, { rescan: Boolean(state.file) });
  });
  refs.dropzone.addEventListener("click", (event) => {
    if (event.target.closest("button, a")) return;
    if (state.inputUrl) return;
    refs.fileInput.click();
  });
  refs.dropzone.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !state.inputUrl) {
      event.preventDefault();
      refs.fileInput.click();
    }
  });
  refs.fileInput.addEventListener("change", () => {
    const file = refs.fileInput.files?.[0];
    if (file) recognize(file);
  });
  ["dragenter", "dragover"].forEach((name) => {
    refs.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      refs.dropzone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    refs.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      refs.dropzone.classList.remove("is-dragging");
    });
  });
  refs.dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) recognize(file);
  });
  refs.imageTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scan-image-tab]");
    if (!button || button.disabled) return;
    setPreview(button.dataset.scanImageTab);
  });
  refs.matches.addEventListener("click", (event) => {
    const button = event.target.closest("[data-match-index]");
    if (!button) return;
    state.selectedIndex = Number(button.dataset.matchIndex) || 0;
    state.marketSource = "SNKR";
    state.selectedConditionKey = "";
    renderDetail();
  });
  refs.multiStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scan-card-index]");
    if (!button) return;
    selectMultiCard(Number(button.dataset.scanCardIndex) || 0);
  });
  refs.rangeRow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-range]");
    if (!button) return;
    state.range = button.dataset.range || "1y";
    refs.rangeRow.querySelectorAll("[data-range]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderDetail();
  });
  refs.conditionRow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-condition]");
    if (!button) return;
    state.selectedConditionKey = button.dataset.condition || "";
    refs.conditionRow.querySelectorAll("[data-condition]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderDetail();
  });
  refs.sourceTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-market-source]");
    if (!button) return;
    state.marketSource = button.dataset.marketSource || "SNKR";
    refs.sourceTabs.querySelectorAll("[data-market-source]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderDetail();
  });
  refs.chart.addEventListener("pointermove", handleChartPointerMove);
  refs.chart.addEventListener("pointerleave", hideChartHover);
  refs.chart.addEventListener("pointercancel", hideChartHover);
  refs.resetButton.addEventListener("click", reset);
  setBetaPanel(false);
  setScanMode(state.scanMode, { force: true });
  drawChart([], null);
})();
