(() => {
  const PROFILE_STORAGE_KEY = "renaiss_profile_state_v1";
  const PROFILE_ACCOUNTS_KEY = "renaiss_profile_accounts_v1";
  const PROFILE_ACCOUNT_STATE_PREFIX = "renaiss_profile_account_state_v1:";
  const SCAN_QUEUE_KEY = "renaiss_profile_scan_additions_v1";
  const WALLET_API_PATH = "/api/card-profile/wallet-collection";
  const CATALOG_API_PATH = "/api/card-profile/catalog-search";
  const SNKR_HISTORY_PATH = "/api/card-scan/snkr-history";
  const RANGE_DAYS = { "1d": 1, "1w": 7, "1m": 31, "1y": 365 };

  const state = {
    user: { name: "", account: "", wallet: "", isAuthenticated: false },
    wallets: [],
    cards: [],
    walletCards: [],
    portfolioHistory: [],
    walletHistory: [],
    selectedCardId: "",
    marketSourceByCard: {},
    activeCollection: "profile",
    toolPanel: "",
    detailOpen: false,
    range: "1y",
    gameFilter: "all",
    filter: "all",
    view: "list",
    sort: "newest",
    marketplace: "renaiss-first",
    scanQueue: [],
    hydrating: new Set(),
  };

  const $ = (selector) => document.querySelector(selector);
  const refs = {
    navLogin: $("#profile-nav-login"),
    navLoginText: $("#profile-nav-login-text"),
    heroSync: $("#profile-hero-sync"),
    appSubtitle: $("#profile-app-subtitle"),
    toolButtons: document.querySelectorAll("[data-tool-panel]"),
    sideStack: $(".profile-side-stack"),
    toolTitle: $("#profile-tool-title"),
    toolClose: $("#profile-tool-close"),
    totalValue: $("#profile-total-value"),
    valueChange: $("#profile-value-change"),
    cardCount: $("#profile-card-count"),
    walletCount: $("#profile-wallet-count"),
    listedCount: $("#profile-listed-count"),
    sourceCount: $("#profile-source-count"),
    valueChart: $("#profile-value-chart"),
    chartNote: $("#profile-chart-note"),
    rangeRow: $("#profile-range-row"),
    cardRangeRow: $("#profile-card-range-row"),
    walletForm: $("#profile-wallet-form"),
    walletInput: $("#profile-wallet-input"),
    walletStatus: $("#profile-wallet-status"),
    walletList: $("#profile-wallet-list"),
    syncCurrent: $("#profile-sync-current"),
    clearWallet: $("#profile-clear-wallet"),
    catalogForm: $("#profile-catalog-form"),
    catalogQuery: $("#profile-catalog-query"),
    catalogGame: $("#profile-catalog-game"),
    catalogLanguage: $("#profile-catalog-language"),
    catalogStatus: $("#profile-catalog-status"),
    catalogResults: $("#profile-catalog-results"),
    addOp16: $("#profile-add-op16"),
    scanQueue: $("#profile-scan-queue"),
    scanStatus: $("#profile-scan-status"),
    gameFilterRow: $("#profile-game-filter-row"),
    filterRow: $("#profile-filter-row"),
    collectionRow: $("#profile-collection-row"),
    importWallet: $("#profile-import-wallet"),
    viewRow: $(".profile-view-row"),
    sortSelect: $("#profile-sort-select"),
    marketSelect: $("#profile-market-select"),
    cardGrid: $("#profile-card-grid"),
    emptyState: $("#profile-empty-state"),
    detailPanel: $("#profile-detail-panel"),
    detailTitle: $("#profile-detail-title"),
    detailRemove: $("#profile-detail-remove"),
    detailClose: $("#profile-detail-close"),
    detailImage: $("#profile-detail-image"),
    detailName: $("#profile-detail-name"),
    detailMeta: $("#profile-detail-meta"),
    detailMetrics: $("#profile-detail-metrics"),
    cardChart: $("#profile-card-chart"),
    cardChartNote: $("#profile-card-chart-note"),
    sourceTabs: $("#profile-source-tabs"),
    marketSnapshot: $("#profile-market-snapshot"),
    listingsTitle: $("#profile-listings-title"),
    detailListings: $("#profile-detail-listings"),
    detailActions: $("#profile-detail-actions"),
    heroWalletTitle: $(".profile-stream-card.is-wallet strong"),
    heroWalletMeta: $(".profile-stream-card.is-wallet em"),
    heroScanTitle: $(".profile-stream-card.is-scan strong"),
    heroScanMeta: $(".profile-stream-card.is-scan em"),
    heroMarketTitle: $(".profile-stream-card.is-market strong"),
    heroMarketMeta: $(".profile-stream-card.is-market em"),
    loginModal: $("#profile-login-modal"),
    loginClose: $("#profile-login-close"),
    loginForm: $("#profile-login-form"),
    loginName: $("#profile-login-name"),
    loginPassword: $("#profile-login-password"),
    loginWallet: $("#profile-login-wallet"),
    loginStatus: $("#profile-login-status"),
    logoutButton: $("#profile-logout-btn"),
    settingsMarket: $("#profile-settings-market"),
    settingsAccount: $("#profile-settings-account"),
  };

  function apiUrl(path) {
    const base = String(localStorage.getItem("intel_api_base") || "").trim().replace(/\/+$/, "");
    if (!base) return path;
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function readAccounts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_ACCOUNTS_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeAccounts(accounts) {
    localStorage.setItem(PROFILE_ACCOUNTS_KEY, JSON.stringify(accounts || {}));
  }

  function normalizeAccount(raw) {
    return String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    const input = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await window.crypto.subtle.digest("SHA-256", input);
    return bytesToHex(new Uint8Array(digest));
  }

  async function loginOrCreateAccount(rawAccount, password, wallet) {
    const account = normalizeAccount(rawAccount);
    if (!account) throw new Error("請輸入帳號。");
    if (String(password || "").length < 6) throw new Error("密碼至少需要 6 個字元。");
    const accounts = readAccounts();
    const existing = accounts[account];
    if (existing) {
      const expected = await hashPassword(password, existing.salt || account);
      if (expected !== existing.passwordHash) throw new Error("帳號或密碼不正確。");
      const nextWallet = wallet || normalizeWallet(existing.wallet);
      accounts[account] = { ...existing, wallet: nextWallet, updatedAt: nowIso() };
      writeAccounts(accounts);
      return { account, name: existing.name || account, wallet: nextWallet };
    }
    const saltBytes = new Uint8Array(16);
    window.crypto.getRandomValues(saltBytes);
    const salt = bytesToHex(saltBytes);
    const passwordHash = await hashPassword(password, salt);
    accounts[account] = {
      name: account,
      salt,
      passwordHash,
      wallet,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    writeAccounts(accounts);
    return { account, name: account, wallet };
  }

  function updateAccountWallet(wallet) {
    const account = normalizeAccount(state.user.account || state.user.name);
    if (!account) return;
    const accounts = readAccounts();
    if (!accounts[account]) return;
    accounts[account] = { ...accounts[account], wallet, updatedAt: nowIso() };
    writeAccounts(accounts);
  }

  function isLoggedIn() {
    return Boolean(state.user.isAuthenticated && normalizeAccount(state.user.account || state.user.name));
  }

  function accountStateKey(account) {
    const normalized = normalizeAccount(account);
    return normalized ? `${PROFILE_ACCOUNT_STATE_PREFIX}${normalized}` : "";
  }

  function profileDataSnapshot() {
    return {
      wallets: state.wallets,
      cards: state.cards,
      walletCards: state.walletCards,
      portfolioHistory: state.portfolioHistory,
      walletHistory: state.walletHistory,
      selectedCardId: state.selectedCardId,
      marketSourceByCard: state.marketSourceByCard,
      activeCollection: state.activeCollection,
      updatedAt: nowIso(),
    };
  }

  function applyProfileData(data = {}) {
    state.wallets = Array.isArray(data.wallets) ? data.wallets : [];
    state.cards = Array.isArray(data.cards) ? data.cards : [];
    state.walletCards = Array.isArray(data.walletCards) ? data.walletCards : [];
    state.portfolioHistory = Array.isArray(data.portfolioHistory) ? data.portfolioHistory : [];
    state.walletHistory = Array.isArray(data.walletHistory) ? data.walletHistory : [];
    state.selectedCardId = String(data.selectedCardId || "");
    state.marketSourceByCard = data.marketSourceByCard && typeof data.marketSourceByCard === "object" ? data.marketSourceByCard : {};
    state.activeCollection = data.activeCollection === "wallet" ? "wallet" : "profile";
  }

  function clearProfileData() {
    applyProfileData();
  }

  function loadAccountProfileData(account) {
    const key = accountStateKey(account);
    if (!key) return false;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}");
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length) {
        applyProfileData(parsed);
        return true;
      }
    } catch (error) {
      console.warn("[profile] failed to load account profile", error);
    }
    clearProfileData();
    return false;
  }

  function saveAccountProfileData() {
    if (!isLoggedIn()) return;
    const key = accountStateKey(state.user.account || state.user.name);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(profileDataSnapshot()));
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object") {
        state.user = { ...state.user, ...(parsed.user || {}) };
        state.wallets = Array.isArray(parsed.wallets) ? parsed.wallets : [];
        state.cards = Array.isArray(parsed.cards) ? parsed.cards : [];
        state.walletCards = Array.isArray(parsed.walletCards) ? parsed.walletCards : [];
        state.portfolioHistory = Array.isArray(parsed.portfolioHistory) ? parsed.portfolioHistory : [];
        state.walletHistory = Array.isArray(parsed.walletHistory) ? parsed.walletHistory : [];
        state.selectedCardId = String(parsed.selectedCardId || "");
        state.marketSourceByCard = parsed.marketSourceByCard && typeof parsed.marketSourceByCard === "object" ? parsed.marketSourceByCard : {};
        state.activeCollection = parsed.activeCollection === "wallet" ? "wallet" : "profile";
        state.range = RANGE_DAYS[parsed.range] ? parsed.range : "1y";
        state.gameFilter = ["all", "pokemon", "one-piece"].includes(parsed.gameFilter) ? parsed.gameFilter : "all";
        state.filter = String(parsed.filter || "all");
        state.view = String(parsed.view || "list") === "grid" ? "grid" : "list";
        state.sort = ["newest", "oldest", "price-high", "price-low", "name"].includes(parsed.sort) ? parsed.sort : "newest";
        state.marketplace = parsed.marketplace === "snkr-first" ? "snkr-first" : "renaiss-first";
      }
    } catch (error) {
      console.warn("[profile] failed to load saved profile", error);
    }
    if (isLoggedIn()) {
      loadAccountProfileData(state.user.account || state.user.name);
    } else {
      clearProfileData();
    }
    state.scanQueue = readScanQueue();
  }

  function saveState() {
    const payload = {
      user: state.user,
      wallets: state.wallets,
      cards: state.cards,
      walletCards: state.walletCards,
      portfolioHistory: state.portfolioHistory,
      walletHistory: state.walletHistory,
      selectedCardId: state.selectedCardId,
      marketSourceByCard: state.marketSourceByCard,
      activeCollection: state.activeCollection,
      range: state.range,
      gameFilter: state.gameFilter,
      filter: state.filter,
      view: state.view,
      sort: state.sort,
      marketplace: state.marketplace,
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(payload));
    saveAccountProfileData();
  }

  function readScanQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCAN_QUEUE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeScanQueue(items) {
    state.scanQueue = items;
    localStorage.setItem(SCAN_QUEUE_KEY, JSON.stringify(items));
  }

  function setStatus(node, message, mode = "") {
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-ok", mode === "ok");
    node.classList.toggle("is-error", mode === "error");
  }

  function normalizeWallet(raw) {
    const value = String(raw || "").trim().toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(value) ? value : "";
  }

  function shortWallet(address) {
    const wallet = normalizeWallet(address) || String(address || "");
    return wallet.length >= 10 ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : wallet;
  }

  function shortHash(hash) {
    const value = String(hash || "").trim();
    return value.length >= 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
  }

  function bscTxUrl(hash) {
    const value = String(hash || "").trim().toLowerCase();
    return /^0x[a-f0-9]{64}$/.test(value) ? `https://bscscan.com/tx/${value}` : "";
  }

  function formatUSD(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "US$0";
    return `US$${Math.round(number).toLocaleString()}`;
  }

  function formatDelta(value, percent) {
    const number = Number(value);
    if (!Number.isFinite(number) || number === 0) return "No change yet";
    const sign = number > 0 ? "+" : "-";
    const pct = Number(percent);
    return `${sign}${formatUSD(Math.abs(number))}${Number.isFinite(pct) ? ` (${sign}${Math.abs(pct).toFixed(1)}%)` : ""}`;
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

  function nowIso() {
    return new Date().toISOString();
  }

  function cardPrice(card, source = "") {
    const market = selectedMarket(card, source);
    const value = market?.marketPriceUsd ?? card.marketPriceUsd ?? card.price_usd ?? card.fmv_usd ?? card.ask_usdt;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function selectedMarket(card, source = "") {
    const markets = card?.markets && typeof card.markets === "object" ? card.markets : {};
    if (source && markets[source]) return markets[source];
    const order = state.marketplace === "snkr-first"
      ? ["SNKR", "Renaiss", "AURANAISS"]
      : ["Renaiss", "SNKR", "AURANAISS"];
    const preferred = order.map((key) => markets[key]).find((market) => market && typeof market === "object");
    return preferred || null;
  }

  function marketSources(card) {
    const markets = card?.markets && typeof card.markets === "object" ? card.markets : {};
    return Object.keys(markets).filter((source) => markets[source] && typeof markets[source] === "object");
  }

  function marketSourceKey(card) {
    return card?.id || sourceKey(card);
  }

  function selectedMarketSource(card) {
    const sources = marketSources(card);
    if (!sources.length) return "";
    const saved = String(state.marketSourceByCard?.[marketSourceKey(card)] || "");
    if (saved && sources.includes(saved)) return saved;
    const order = state.marketplace === "snkr-first"
      ? ["SNKR", "Renaiss", "AURANAISS"]
      : ["Renaiss", "SNKR", "AURANAISS"];
    const preferred = order.find((source) => sources.includes(source));
    if (preferred) return preferred;
    return sources[0];
  }

  function setSelectedMarketSource(card, source) {
    if (!card || !source || !marketSources(card).includes(source)) return false;
    state.marketSourceByCard = {
      ...(state.marketSourceByCard || {}),
      [marketSourceKey(card)]: source,
    };
    return true;
  }

  function cardImage(card) {
    return card.imageUrl || card.display_image_url || card.image_url || card.capturedImageUri || "";
  }

  function cardSourceLabel(card) {
    if (card.origin === "wallet") return card.walletSource === "chain_official" ? "Wallet" : "Renaiss Wallet";
    if (card.origin === "wallet-import") return "Renaiss Wallet";
    if (card.origin === "scan") return "Scan";
    if (card.origin === "catalog") return "Catalog";
    return card.source || "Tracked";
  }

  function sourceKey(card) {
    if ((card.origin === "wallet" || card.origin === "wallet-import") && card.tokenId) return `wallet:${card.tokenId}`;
    if (card.snkrProductId) return `snkr:${card.snkrProductId}`;
    if (card.cardCode) return `catalog:${card.game || ""}:${card.language || ""}:${card.cardCode}:${card.variant || ""}`;
    return card.id || `local:${randomId()}`;
  }

  function activeCards() {
    return state.activeCollection === "wallet" ? state.walletCards : state.cards;
  }

  function activeHistory() {
    return state.activeCollection === "wallet" ? state.walletHistory : state.portfolioHistory;
  }

  function setActiveHistory(points) {
    if (state.activeCollection === "wallet") {
      state.walletHistory = points;
    } else {
      state.portfolioHistory = points;
    }
  }

  function findCard(cardId) {
    return activeCards().find((item) => item.id === cardId)
      || state.cards.find((item) => item.id === cardId)
      || state.walletCards.find((item) => item.id === cardId);
  }

  function ensureSelection() {
    const cards = activeCards();
    if (!cards.some((card) => card.id === state.selectedCardId)) {
      state.selectedCardId = cards[0]?.id || "";
    }
  }

  function isMobileLayout() {
    return window.matchMedia?.("(max-width: 720px)")?.matches || window.innerWidth <= 720;
  }

  function randomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function normalizeWalletCard(raw, wallet) {
    const tokenId = String(raw.token_id || raw.tokenId || "").trim();
    const price = Number(raw.price_usd ?? raw.fmv_usd ?? raw.ask_usdt ?? 0) || 0;
    const grade = [raw.grading_company || raw.gradingCompany, raw.grade].filter(Boolean).join(" ").trim();
    const catalogMatch = raw.catalog_match && typeof raw.catalog_match === "object" ? raw.catalog_match : null;
    const catalogRecord = catalogMatch?.record && typeof catalogMatch.record === "object" ? catalogMatch.record : {};
    const catalogSnkr = catalogRecord.snkr && typeof catalogRecord.snkr === "object" ? catalogRecord.snkr : {};
    const catalogImage = String(raw.catalog_image_url || catalogRecord.display_image_url || catalogRecord.reference_image_url || catalogRecord.image_url || "");
    const catalogCardCode = String(raw.catalog_card_code || catalogRecord.card_code || "");
    const snkrProductId = String(raw.snkr_product_id || catalogSnkr.product_id || "");
    const acquisition = raw.acquisition && typeof raw.acquisition === "object" ? raw.acquisition : {};
    const acquiredAt = String(raw.acquired_at || acquisition.acquired_at || "");
    return {
      id: `wallet:${tokenId || randomId()}`,
      origin: "wallet",
      source: "Renaiss",
      tokenId,
      walletAddress: normalizeWallet(raw.wallet_address || wallet || raw.owner_address),
      rawOwnerAddress: normalizeWallet(raw.raw_owner_address || raw.owner_address),
      officialOwnerAddress: normalizeWallet(raw.official_owner_address),
      ownershipVerified: Boolean(raw.ownership_verified),
      walletSource: String(raw.wallet_source || (raw.ownership_verified ? "chain_official" : "unverified")),
      ownerUsername: String(raw.owner_username || ""),
      name: String(raw.name || "Unknown Collectible"),
      setName: String(raw.set_name || raw.setName || raw.catalog_set_id || catalogRecord.set_id || ""),
      number: String(raw.card_number || raw.cardNumber || catalogCardCode || ""),
      cardCode: String(catalogCardCode || raw.card_code || raw.cardCode || raw.card_number || ""),
      game: String(raw.game || "Renaiss"),
      language: String(raw.language || ""),
      condition: grade,
      serial: String(raw.serial || ""),
      imageUrl: String(raw.image_url || raw.imageUrl || ""),
      catalogMatchStatus: String(raw.catalog_match_status || "unmatched"),
      catalogMatchConfidence: String(catalogMatch?.confidence || ""),
      catalogName: String(raw.catalog_name || catalogRecord.name_en || catalogRecord.name || catalogRecord.name_ja || ""),
      catalogSetId: String(raw.catalog_set_id || catalogRecord.set_id || ""),
      catalogCardCode,
      catalogImageUrl: catalogImage,
      snkrProductId,
      acquiredAt,
      acquiredTimestamp: Number(raw.acquired_timestamp || acquisition.acquired_timestamp || 0) || 0,
      acquisitionTxHash: String(raw.acquisition_tx_hash || acquisition.tx_hash || ""),
      acquisitionFromAddress: normalizeWallet(raw.acquisition_from_address || acquisition.from_address),
      acquisitionToAddress: normalizeWallet(raw.acquisition_to_address || acquisition.to_address),
      acquisitionAddress: normalizeWallet(raw.acquisition_address || acquisition.acquisition_address),
      acquisitionAddressKind: String(raw.acquisition_address_kind || acquisition.acquisition_address_kind || ""),
      acquisitionSource: String(raw.acquisition_source || acquisition.source || ""),
      url: String(raw.url || (tokenId ? `https://www.renaiss.xyz/card/${tokenId}` : "")),
      marketPriceUsd: price,
      priceHistory: [],
      listings: [],
      markets: {
        Renaiss: {
          source: "Renaiss",
          marketPriceUsd: price,
          priceHistory: [],
          listings: [{
            id: tokenId || randomId(),
            title: String(raw.name || "Renaiss collectible"),
            grade,
            askUsd: Number(raw.ask_usdt || 0) || undefined,
            fmvUsd: Number(raw.fmv_usd || 0) || undefined,
            language: String(raw.language || ""),
            status: raw.is_listed ? "Listed" : "Holding",
            imageUrl: String(raw.image_url || ""),
            url: String(raw.url || ""),
            source: "Renaiss",
          }],
        },
        ...(snkrProductId ? {
          SNKR: {
            source: "SNKR",
            marketPriceUsd: Number(catalogSnkr.min_price || 0) || 0,
            productId: snkrProductId,
            productName: String(catalogSnkr.product_name || raw.catalog_name || raw.name || ""),
            priceHistory: [],
            listings: [{
              id: snkrProductId,
              title: String(catalogSnkr.product_name || raw.catalog_name || raw.name || ""),
              imageUrl: catalogImage,
              url: String(catalogSnkr.url || ""),
              source: "SNKR",
            }],
          },
        } : {}),
      },
      addedAt: nowIso(),
      updatedAt: nowIso(),
    };
  }

  function normalizeCatalogCard(raw, origin = "catalog") {
    const snkr = raw?.snkr && typeof raw.snkr === "object" ? raw.snkr : {};
    const snkrProductId = String(snkr.product_id || raw.snkr_product_id || raw.product_id || "").trim();
    const cardCode = String(raw.card_code || raw.card_id || raw.number || "").trim();
    const imageUrl = String(raw.display_image_url || raw.reference_image_url || raw.image_url || "");
    const price = Number(snkr.min_price || raw.marketPriceUsd || raw.market_price_usd || 0) || 0;
    const name = String(raw.name_en || raw.name_ja || raw.name || snkr.product_name || "Unknown card");
    return {
      id: snkrProductId ? `snkr:${snkrProductId}` : `catalog:${raw.game || ""}:${raw.language || ""}:${cardCode}:${raw.variant || raw.rank || randomId()}`,
      origin,
      source: snkrProductId ? "SNKR" : "Catalog",
      snkrProductId,
      name,
      setName: String(raw.set_id || raw.setName || ""),
      number: cardCode,
      cardCode,
      game: String(raw.game_family || raw.game || ""),
      language: String(raw.language || ""),
      condition: "RAW A",
      rarity: String(raw.rarity || ""),
      variant: String(raw.variant || ""),
      imageUrl,
      url: String(snkr.url || ""),
      marketPriceUsd: price,
      priceHistory: [],
      listings: [],
      markets: snkrProductId ? {
        SNKR: {
          source: "SNKR",
          marketPriceUsd: price,
          productId: snkrProductId,
          productName: String(snkr.product_name || name),
          priceHistory: [],
          listings: [{
            id: snkrProductId,
            title: String(snkr.product_name || name),
            imageUrl,
            url: String(snkr.url || ""),
            source: "SNKR",
          }],
          condition: "RAW A",
        },
      } : {},
      rawLookup: raw,
      addedAt: nowIso(),
      updatedAt: nowIso(),
    };
  }

  function normalizeScanCard(raw) {
    const card = normalizeCatalogCard(raw.rawLookup || raw, "scan");
    return {
      ...card,
      id: raw.id || card.id,
      origin: "scan",
      capturedImageUri: raw.capturedImageUri || raw.cropUrl || raw.inputUrl || "",
      imageUrl: raw.imageUrl || card.imageUrl,
      marketPriceUsd: Number(raw.marketPriceUsd || card.marketPriceUsd || 0) || 0,
      priceHistory: Array.isArray(raw.priceHistory) ? raw.priceHistory : card.priceHistory,
      addedAt: raw.addedAt || nowIso(),
      updatedAt: raw.updatedAt || nowIso(),
    };
  }

  function upsertCards(nextCards, target = "profile") {
    const isWalletTarget = target === "wallet";
    const current = isWalletTarget ? state.walletCards : state.cards;
    const byId = new Map(current.map((card) => [sourceKey(card), card]));
    let changed = 0;
    nextCards.forEach((incoming) => {
      const key = sourceKey(incoming);
      const previous = byId.get(key);
      if (previous) {
        byId.set(key, {
          ...previous,
          ...incoming,
          id: previous.id || incoming.id,
          addedAt: previous.addedAt || incoming.addedAt || nowIso(),
          priceHistory: mergePriceHistory(previous.priceHistory, incoming.priceHistory),
          markets: { ...(previous.markets || {}), ...(incoming.markets || {}) },
          updatedAt: nowIso(),
        });
      } else {
        byId.set(key, incoming);
      }
      changed += 1;
    });
    const next = Array.from(byId.values());
    if (isWalletTarget) {
      state.walletCards = next;
    } else {
      state.cards = next;
    }
    if (state.activeCollection === target || !state.selectedCardId) {
      state.selectedCardId = next[0]?.id || state.selectedCardId;
    }
    recordPortfolioSnapshot(target);
    saveState();
    render();
    nextCards.forEach((card) => {
      if (card.snkrProductId) void hydrateSNKR(card.id);
    });
    return changed;
  }

  function mergePriceHistory(left, right) {
    const byDate = new Map();
    [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].forEach((point) => {
      const date = String(point?.date || point?.label || "");
      const price = Number(point?.price);
      if (!date || !Number.isFinite(price) || price <= 0) return;
      byDate.set(date.slice(0, 10), { ...point, date, price: Math.round(price) });
    });
    return Array.from(byDate.values()).sort((a, b) => Date.parse(a.date || "") - Date.parse(b.date || "")).slice(-365);
  }

  function recordPortfolioSnapshot(target = state.activeCollection) {
    const collection = target === "wallet" ? state.walletCards : state.cards;
    const total = portfolioTotal(collection);
    if (total <= 0) return;
    const today = new Date().toISOString();
    const day = today.slice(0, 10);
    const history = Array.isArray(target === "wallet" ? state.walletHistory : state.portfolioHistory)
      ? (target === "wallet" ? state.walletHistory : state.portfolioHistory)
      : [];
    const last = history[history.length - 1];
    if (last && String(last.date || "").slice(0, 10) === day) {
      last.price = Math.round(total);
      last.date = today;
      last.label = shortDate(today);
    } else {
      history.push({ date: today, label: shortDate(today), price: Math.round(total) });
    }
    if (target === "wallet") {
      state.walletHistory = history.slice(-365);
    } else {
      state.portfolioHistory = history.slice(-365);
    }
  }

  function portfolioTotal(cards = activeCards()) {
    return cards.reduce((sum, card) => sum + cardPrice(card), 0);
  }

  function portfolioChange(points) {
    if (!points || points.length < 2) return null;
    const first = Number(points[0].price);
    const last = Number(points[points.length - 1].price);
    if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(last)) return null;
    return { value: last - first, percent: ((last - first) / first) * 100 };
  }

  function filterRange(points, range) {
    const rows = Array.isArray(points) ? points : [];
    if (!rows.length) return [];
    const latest = rows.reduce((max, point) => Math.max(max, Date.parse(point.date || "") || 0), 0);
    if (!latest) return rows;
    const cutoff = latest - (RANGE_DAYS[range] || 365) * 86400000;
    const filtered = rows.filter((point) => (Date.parse(point.date || "") || 0) >= cutoff);
    return filtered.length ? filtered : rows.slice(-1);
  }

  function dayKey(value) {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
  }

  function cardSortTime(card) {
    const parsed = Date.parse(card?.scannedAt || card?.addedAt || card?.updatedAt || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function cardMatchesGameFilter(card) {
    if (state.gameFilter === "all") return true;
    const haystack = [
      card?.game,
      card?.game_family,
      card?.setName,
      card?.catalogSetId,
      card?.number,
      card?.cardCode,
      card?.catalogCardCode,
      card?.name,
      card?.catalogName,
    ].filter(Boolean).join(" ").toLowerCase().replace(/[_-]+/g, " ");
    if (state.gameFilter === "pokemon") {
      return haystack.includes("pokemon") || haystack.includes("pokémon");
    }
    if (state.gameFilter === "one-piece") {
      return haystack.includes("one piece")
        || haystack.includes("onepiece")
        || /\bop\d{2,}/i.test(String(card?.setName || card?.catalogSetId || card?.cardCode || card?.number || ""));
    }
    return true;
  }

  function cardMatchesSourceFilter(card) {
    if (state.filter === "all") return true;
    if (state.filter === "wallet") return card.origin === "wallet" || card.origin === "wallet-import";
    return card.origin === state.filter;
  }

  function cardHistoryPoints(card) {
    const market = selectedMarket(card);
    let points = mergePriceHistory(card?.priceHistory || [], market?.priceHistory || []);
    const current = cardPrice(card);
    if (current > 0) {
      const date = nowIso();
      points = mergePriceHistory(points, [{ date, label: shortDate(date), price: Math.round(current) }]);
    }
    return points.filter((point) => dayKey(point.date || point.label));
  }

  function latestPointOnOrBefore(points, dayTime) {
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const parsed = Date.parse(points[index]?.date || points[index]?.label || "");
      if (Number.isFinite(parsed) && parsed <= dayTime) return points[index];
    }
    return null;
  }

  function buildPortfolioHistory(cards) {
    const series = cards.map(cardHistoryPoints).filter((points) => points.length);
    if (!series.length) return [];
    const days = new Set();
    series.forEach((points) => {
      points.forEach((point) => {
        const day = dayKey(point.date || point.label);
        if (day) days.add(day);
      });
    });
    return Array.from(days).sort().map((day) => {
      const dayTime = Date.parse(`${day}T23:59:59.999Z`);
      let total = 0;
      let sourceCount = 0;
      series.forEach((points) => {
        const point = latestPointOnOrBefore(points, dayTime);
        const price = Number(point?.price);
        if (Number.isFinite(price) && price > 0) {
          total += price;
          sourceCount += 1;
        }
      });
      return {
        date: new Date(`${day}T00:00:00.000Z`).toISOString(),
        label: shortDate(day),
        price: Math.round(total),
        sourceCount,
      };
    }).filter((point) => point.price > 0).slice(-365);
  }

  function portfolioHistoryForCards(cards) {
    const saved = activeHistory();
    const derived = buildPortfolioHistory(cards);
    const combined = mergePriceHistory(saved, derived);
    return combined.length ? combined : saved;
  }

  function shortDate(value) {
    const parsed = Date.parse(String(value || ""));
    if (!Number.isFinite(parsed)) return String(value || "").slice(0, 10);
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(parsed));
  }

  function formatDateTime(value) {
    const parsed = Date.parse(String(value || ""));
    if (!Number.isFinite(parsed)) return "";
    return new Intl.DateTimeFormat("zh-Hant", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(parsed));
  }

  function chartTooltip(svg) {
    const wrap = svg?.closest?.(".profile-chart-wrap");
    if (!wrap) return null;
    let tooltip = wrap.querySelector(".profile-chart-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "profile-chart-tooltip";
      wrap.appendChild(tooltip);
    }
    return tooltip;
  }

  function setChartHover(svg, note, rows, coords, defaultNote) {
    if (!svg) return;
    const tooltip = chartTooltip(svg);
    const line = svg.querySelector("[data-hover-line]");
    const dot = svg.querySelector("[data-hover-dot]");
    const data = Array.isArray(rows) ? rows : [];
    const points = Array.isArray(coords) ? coords : [];
    if (!tooltip || !line || !dot || !data.length || !points.length) {
      svg.onpointermove = null;
      svg.onpointerleave = null;
      return;
    }
    svg.style.touchAction = "none";
    svg.onpointermove = (event) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const viewX = ((event.clientX - rect.left) / rect.width) * 720;
      let nearest = points[0];
      let nearestIndex = 0;
      points.forEach((point, index) => {
        if (Math.abs(point.x - viewX) < Math.abs(nearest.x - viewX)) {
          nearest = point;
          nearestIndex = index;
        }
      });
      const row = data[nearestIndex] || nearest.point || data[0];
      line.setAttribute("x1", nearest.x.toFixed(1));
      line.setAttribute("x2", nearest.x.toFixed(1));
      line.setAttribute("opacity", "1");
      dot.setAttribute("cx", nearest.x.toFixed(1));
      dot.setAttribute("cy", nearest.y.toFixed(1));
      dot.setAttribute("opacity", "1");
      tooltip.hidden = false;
      tooltip.textContent = `${row.label || shortDate(row.date)} · ${formatUSD(row.price)}`;
      const left = Math.min(Math.max(event.clientX - rect.left + 12, 8), Math.max(8, rect.width - tooltip.offsetWidth - 8));
      const top = Math.min(Math.max(event.clientY - rect.top - 36, 8), Math.max(8, rect.height - tooltip.offsetHeight - 8));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      if (note) note.textContent = `${row.label || shortDate(row.date)} · ${formatUSD(row.price)}`;
    };
    svg.onpointerleave = () => {
      line.setAttribute("opacity", "0");
      dot.setAttribute("opacity", "0");
      tooltip.hidden = true;
      if (note) note.textContent = defaultNote || "";
    };
  }

  function drawChart(svg, note, points, currentPrice, emptyLabel) {
    if (!svg) return;
    const rows = filterRange(points, state.range);
    const width = 720;
    const height = 232;
    const pad = { left: 34, right: 26, top: 26, bottom: 38 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const price = Number(currentPrice);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = `
      <defs>
        <linearGradient id="profileChartRainbow" x1="0" x2="1" y1="0" y2="0">
          <stop stop-color="#73fff1"/>
          <stop offset=".28" stop-color="#66a9ff"/>
          <stop offset=".58" stop-color="#22c49c"/>
          <stop offset="1" stop-color="#f5b74b"/>
        </linearGradient>
        <linearGradient id="profileChartArea" x1="0" x2="0" y1="0" y2="1">
          <stop stop-color="rgba(115,255,241,.22)"/>
          <stop offset=".58" stop-color="rgba(34,196,156,.09)"/>
          <stop offset="1" stop-color="rgba(255,255,255,0)"/>
        </linearGradient>
      </defs>
      <g opacity=".9">
        ${[0.25, 0.5, 0.75].map((ratio) => `<line x1="0" y1="${(pad.top + innerH * ratio).toFixed(1)}" x2="${width}" y2="${(pad.top + innerH * ratio).toFixed(1)}" stroke="rgba(72,106,139,.12)" stroke-width="1"/>`).join("")}
        ${Array.from({ length: 7 }, (_, index) => {
          const x = pad.left + (innerW * index) / 6;
          return `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${height}" stroke="rgba(72,106,139,.08)" stroke-width="1"/>`;
        }).join("")}
      </g>
    `;
    if (rows.length < 2) {
      if (Number.isFinite(price) && price > 0) {
        const y = pad.top + innerH * 0.5;
        const path = `M ${pad.left} ${y} C ${pad.left + innerW * 0.22} ${y - 16}, ${pad.left + innerW * 0.5} ${y + 14}, ${width - pad.right} ${y - 4}`;
        const singleDate = rows[0]?.date || nowIso();
        const singleRow = rows[0] || { date: singleDate, label: shortDate(singleDate), price: Math.round(price) };
        svg.insertAdjacentHTML("beforeend", `
          <path d="${path}" fill="none" stroke="url(#profileChartRainbow)" stroke-width="7" stroke-linecap="round" opacity=".24"/>
          <path d="${path}" fill="none" stroke="url(#profileChartRainbow)" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="${width - pad.right}" cy="${y - 4}" r="5" fill="#f7ff7c"/>
          <line data-hover-line x1="${width - pad.right}" y1="${pad.top}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(23,52,84,.34)" stroke-width="1.4" stroke-dasharray="5 5" opacity="0"/>
          <circle data-hover-dot cx="${width - pad.right}" cy="${y - 4}" r="8" fill="rgba(47,110,255,.22)" stroke="#2f6eff" stroke-width="2" opacity="0"/>
          <text x="${pad.left}" y="${pad.top + 16}" fill="#173454" font-size="20" font-weight="900">${escapeHtml(formatUSD(price))}</text>
        `);
        const defaultNote = "目前只有最新價格；之後每次同步會累積追蹤曲線。";
        if (note) note.textContent = defaultNote;
        setChartHover(svg, note, [singleRow], [{ x: width - pad.right, y: y - 4, point: singleRow }], defaultNote);
      } else {
        svg.insertAdjacentHTML("beforeend", `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="rgba(54,78,105,.64)" font-size="18" font-weight="850">${escapeHtml(emptyLabel || "No price data yet")}</text>`);
        if (note) note.textContent = emptyLabel || "目前沒有可用價格資料。";
        setChartHover(svg, note, [], [], note?.textContent || "");
      }
      return;
    }
    const min = Math.min(...rows.map((point) => Number(point.price)));
    const max = Math.max(...rows.map((point) => Number(point.price)));
    const span = Math.max(1, max - min);
    const domainMin = Math.max(0, min - span * 0.16);
    const domainMax = max + span * 0.16;
    const domainSpan = Math.max(1, domainMax - domainMin);
    const coords = rows.map((point, index) => ({
      x: pad.left + (innerW * index) / Math.max(1, rows.length - 1),
      y: pad.top + innerH - ((Number(point.price) - domainMin) / domainSpan) * innerH,
      point,
    }));
    const line = coords.map((coord, index) => `${index ? "L" : "M"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`).join(" ");
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${pad.top + innerH} L ${coords[0].x.toFixed(1)} ${pad.top + innerH} Z`;
    const latest = coords[coords.length - 1];
    svg.insertAdjacentHTML("beforeend", `
      <path d="${area}" fill="url(#profileChartArea)" opacity=".8"/>
      <path d="${line}" fill="none" stroke="url(#profileChartRainbow)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".22"/>
      <path d="${line}" fill="none" stroke="url(#profileChartRainbow)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${latest.x.toFixed(1)}" cy="${latest.y.toFixed(1)}" r="12" fill="rgba(247,255,124,.34)"/>
      <circle cx="${latest.x.toFixed(1)}" cy="${latest.y.toFixed(1)}" r="5" fill="#f7ff7c"/>
      <line data-hover-line x1="${latest.x.toFixed(1)}" y1="${pad.top}" x2="${latest.x.toFixed(1)}" y2="${pad.top + innerH}" stroke="rgba(23,52,84,.34)" stroke-width="1.4" stroke-dasharray="5 5" opacity="0"/>
      <circle data-hover-dot cx="${latest.x.toFixed(1)}" cy="${latest.y.toFixed(1)}" r="8" fill="rgba(47,110,255,.22)" stroke="#2f6eff" stroke-width="2" opacity="0"/>
      <text x="${pad.left}" y="${height - 12}" fill="rgba(54,78,105,.62)" font-size="14" font-weight="800">${escapeHtml(rows[0].label || shortDate(rows[0].date))}</text>
      <text x="${width - pad.right}" y="${height - 12}" text-anchor="end" fill="rgba(54,78,105,.62)" font-size="14" font-weight="800">${escapeHtml(rows[rows.length - 1].label || shortDate(rows[rows.length - 1].date))}</text>
      <text x="${width - pad.right}" y="${pad.top + 13}" text-anchor="end" fill="rgba(54,78,105,.56)" font-size="13" font-weight="800">${escapeHtml(formatUSD(max))}</text>
    `);
    const defaultNote = `${rows.length} points · latest ${formatUSD(rows[rows.length - 1].price)}`;
    if (note) note.textContent = defaultNote;
    setChartHover(svg, note, rows, coords, defaultNote);
  }

  function visibleCards() {
    const filtered = activeCards().filter((card) => cardMatchesGameFilter(card) && cardMatchesSourceFilter(card));
    return filtered.sort((left, right) => {
      if (state.sort === "price-high") return cardPrice(right) - cardPrice(left);
      if (state.sort === "price-low") return cardPrice(left) - cardPrice(right);
      if (state.sort === "name") return String(left.name || "").localeCompare(String(right.name || ""));
      if (state.sort === "oldest") return cardSortTime(left) - cardSortTime(right);
      return cardSortTime(right) - cardSortTime(left);
    });
  }

  function renderSummary() {
    const cards = activeCards();
    const history = portfolioHistoryForCards(cards);
    const total = portfolioTotal(cards);
    const points = filterRange(history, state.range);
    const change = portfolioChange(points);
    refs.totalValue.textContent = formatUSD(total);
    refs.valueChange.textContent = change ? formatDelta(change.value, change.percent) : "No change yet";
    refs.valueChange.classList.toggle("is-down", Boolean(change && change.value < 0));
    refs.cardCount.textContent = String(cards.length);
    refs.walletCount.textContent = String(state.wallets.length);
    refs.listedCount.textContent = String(cards.filter((card) => Boolean(selectedMarket(card)?.listings?.some((listing) => listing.status === "Listed" || listing.askUsd))).length);
    refs.sourceCount.textContent = String(new Set(cards.map((card) => cardSourceLabel(card))).size || 0);
    if (refs.heroWalletTitle) refs.heroWalletTitle.textContent = state.wallets[0]?.address ? shortWallet(state.wallets[0].address) : "未綁定";
    if (refs.heroWalletMeta) refs.heroWalletMeta.textContent = state.wallets[0]?.address ? `${state.walletCards.length} cards · chain verified` : "輸入地址後同步";
    if (refs.heroScanTitle) refs.heroScanTitle.textContent = state.scanQueue.length ? `${state.scanQueue.length} 張待匯入` : "待掃描";
    if (refs.heroScanMeta) refs.heroScanMeta.textContent = state.scanQueue.length ? "掃描結果可加入追蹤" : "登入後可匯入";
    if (refs.heroMarketTitle) refs.heroMarketTitle.textContent = formatUSD(total);
    if (refs.heroMarketMeta) refs.heroMarketMeta.textContent = cards.length ? `${cards.length} cards tracked` : "尚未追蹤";
    drawChart(refs.valueChart, refs.chartNote, history, total, state.activeCollection === "wallet" ? "No wallet value yet" : "No tracked value yet");
    updateRangeButtons();
  }

  function updateRangeButtons() {
    [refs.rangeRow, refs.cardRangeRow].forEach((row) => {
      row?.querySelectorAll("[data-range]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.range === state.range);
      });
    });
  }

  function renderCollectionControls() {
    refs.collectionRow?.querySelectorAll("[data-collection]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.collection === state.activeCollection);
    });
    if (refs.importWallet) {
      refs.importWallet.hidden = state.activeCollection !== "wallet";
      refs.importWallet.disabled = state.walletCards.length === 0;
    }
  }

  function walletResolutionLabel(resolution = {}) {
    if (resolution.display_source === "chain_official") return "chain verified";
    if (resolution.display_source === "empty") return "no holdings";
    return "wallet sync";
  }

  function renderWallets() {
    if (!state.wallets.length) {
      refs.walletList.innerHTML = `<div class="profile-empty-state" style="min-height: 120px;"><div><iconify-icon icon="lucide:wallet"></iconify-icon><p>尚未加入錢包。</p></div></div>`;
      return;
    }
    refs.walletList.innerHTML = state.wallets.map((wallet) => `
      <div class="profile-wallet-row">
        <div>
          <strong>${escapeHtml(wallet.label || shortWallet(wallet.address))}</strong>
          <span>${escapeHtml(shortWallet(wallet.address))} · ${Number(wallet.cardCount || 0)} cards · ${escapeHtml(walletResolutionLabel(wallet.resolution))}</span>
        </div>
        <button class="profile-ghost-btn" type="button" data-sync-wallet="${escapeAttr(wallet.address)}">同步</button>
      </div>
    `).join("");
  }

  function renderScanQueue() {
    if (!state.scanQueue.length) {
      refs.scanQueue.innerHTML = `<div class="profile-empty-list"><li><span>尚無掃描匯入項目</span></li></div>`;
      setStatus(refs.scanStatus, "掃描頁加入追蹤後，會在這裡出現可匯入的卡片。");
      return;
    }
    refs.scanQueue.innerHTML = state.scanQueue.map((item, index) => `
      <div class="profile-scan-row">
        <div>
          <strong>${escapeHtml(item.name || "Scanned card")}</strong>
          <span>${escapeHtml([item.setName, item.number, item.snkrProductId].filter(Boolean).join(" · ") || "Card Scan")}</span>
        </div>
        <button class="profile-ghost-btn" type="button" data-import-scan="${index}">匯入</button>
      </div>
    `).join("");
    setStatus(refs.scanStatus, `${state.scanQueue.length} 張掃描結果可匯入。`, "ok");
  }

  function renderCards() {
    ensureSelection();
    const cards = visibleCards();
    if (cards.length && !cards.some((card) => card.id === state.selectedCardId)) {
      state.selectedCardId = cards[0].id;
    } else if (!cards.length) {
      state.selectedCardId = "";
      state.detailOpen = false;
    }
    refs.emptyState.hidden = cards.length > 0;
    refs.cardGrid.hidden = cards.length === 0;
    refs.cardGrid.classList.toggle("is-grid", state.view === "grid");
    refs.cardGrid.innerHTML = cards.map((card) => {
      const price = cardPrice(card);
      const image = cardImage(card);
      const acquired = formatDateTime(card.acquiredAt);
      return `
        <button class="profile-card ${card.id === state.selectedCardId ? "is-active" : ""}" type="button" data-card-id="${escapeAttr(card.id)}">
          ${image ? `<img src="${escapeAttr(image)}" alt="" loading="lazy" />` : `<img src="./assets/renaiss-logo-alpha-cropped.png" alt="" loading="lazy" />`}
          <span class="profile-card-copy">
            <span class="profile-card-name">${escapeHtml(card.name || "Unknown card")}</span>
            <span class="profile-card-meta">${escapeHtml([card.setName, card.number || card.cardCode, card.language].filter(Boolean).join(" · ") || "Card metadata unavailable")}</span>
            <span class="profile-card-source"><em>${escapeHtml(cardSourceLabel(card))}</em>${card.condition ? ` ${escapeHtml(card.condition)}` : ""}</span>
            ${acquired ? `<span class="profile-card-acquired">最近取得 ${escapeHtml(acquired)}</span>` : ""}
          </span>
          <span class="profile-card-price">
            <strong>${escapeHtml(formatUSD(price))}</strong>
            <span>${escapeHtml(card.snkrProductId ? `SNKR ${card.snkrProductId}` : (card.tokenId ? `R ${String(card.tokenId).slice(-6)}` : "Tracked"))}</span>
          </span>
        </button>
      `;
    }).join("");
    refs.gameFilterRow?.querySelectorAll("[data-game-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.gameFilter === state.gameFilter));
    refs.filterRow?.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.filter === state.filter));
    refs.viewRow?.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === state.view));
    if (refs.sortSelect) refs.sortSelect.value = state.sort;
    if (refs.marketSelect) refs.marketSelect.value = state.marketplace;
  }

  function renderMarketSnapshot(card, market, activeSource, marketProduct) {
    if (!refs.marketSnapshot) return;
    const rows = [
      ["Source", market?.source || activeSource || card.source || cardSourceLabel(card)],
      ["Product ID", marketProduct],
      ["Acquired", formatDateTime(card.acquiredAt) || "Unknown"],
      ["Game", card.game || "Unknown"],
      ["Language", card.language || "Unknown"],
      ["Condition", market?.condition || card.condition || "Not detected"],
      market?.error ? ["Live status", market.error] : null,
      ["Display", "USD"],
    ].filter(Boolean);
    refs.marketSnapshot.innerHTML = `
      <div class="profile-listings-head">
        <span class="profile-kicker">Market snapshot</span>
        <strong>${escapeHtml(market?.source || activeSource || "Tracked")}</strong>
      </div>
      ${rows.map(([label, value]) => `
        <div class="profile-snapshot-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value || "--")}</strong>
        </div>
      `).join("")}
    `;
  }

  function listingDisplayPrice(listing) {
    const ask = Number(listing?.askUsd);
    const fmv = Number(listing?.fmvUsd);
    if (Number.isFinite(ask) && ask > 0) return formatUSD(ask);
    if (Number.isFinite(fmv) && fmv > 0) return `FMV ${formatUSD(fmv)}`;
    return "Open";
  }

  function listingImage(listing) {
    return String(listing?.imageUrl || listing?.cachedImageUri || "");
  }

  function renderListings(market, activeSource) {
    if (!refs.detailListings) return;
    const listings = Array.isArray(market?.listings) ? market.listings : [];
    if (refs.listingsTitle) refs.listingsTitle.textContent = `${listings.length} linked`;
    if (!listings.length) {
      refs.detailListings.innerHTML = `
        <div class="profile-empty-listing">
          No linked ${escapeHtml(activeSource || "market")} listings returned yet.
        </div>
      `;
      return;
    }
    refs.detailListings.innerHTML = listings.map((listing) => {
      const image = listingImage(listing);
      const meta = [listing.grade, listing.language, listing.status, listing.id].filter(Boolean).join(" · ");
      const body = `
        ${image ? `<img src="${escapeAttr(image)}" alt="" loading="lazy" />` : `<img src="./assets/renaiss-logo-alpha-cropped.png" alt="" loading="lazy" />`}
        <span class="profile-listing-copy">
          <strong>${escapeHtml(listing.title || listing.id || "Linked listing")}</strong>
          <span>${escapeHtml(meta || activeSource || "Listing")}</span>
        </span>
        <span class="profile-listing-price">
          <strong>${escapeHtml(listingDisplayPrice(listing))}</strong>
          ${listing.fmvUsd && listing.askUsd ? `<em>FMV ${escapeHtml(formatUSD(listing.fmvUsd))}</em>` : ""}
        </span>
      `;
      return listing.url
        ? `<a class="profile-listing-row" href="${escapeAttr(listing.url)}" target="_blank" rel="noreferrer">${body}</a>`
        : `<div class="profile-listing-row">${body}</div>`;
    }).join("");
  }

  function renderDetail() {
    const card = activeCards().find((item) => item.id === state.selectedCardId);
    const mobile = isMobileLayout();
    refs.detailPanel.hidden = !card || (mobile && !state.detailOpen);
    refs.detailPanel.classList.toggle("is-open", Boolean(card && (!mobile || state.detailOpen)));
    if (!card) return;
    const activeSource = selectedMarketSource(card);
    const market = selectedMarket(card, activeSource);
    const price = cardPrice(card, activeSource);
    const image = cardImage(card);
    refs.detailTitle.textContent = activeSource || cardSourceLabel(card);
    refs.detailRemove.hidden = state.activeCollection === "wallet";
    refs.detailImage.src = image || "./assets/renaiss-logo-alpha-cropped.png";
    refs.detailImage.alt = card.name || "Tracked card";
    refs.detailName.textContent = card.name || "Unknown card";
    refs.detailMeta.textContent = [card.game, card.setName, card.number || card.cardCode, card.language, card.condition].filter(Boolean).join(" · ") || "Card metadata unavailable";
    const marketProduct = market?.source === "SNKR"
      ? (market.productId || card.snkrProductId || market.productName || "--")
      : (card.tokenId ? `R-${String(card.tokenId).slice(-6)}` : (market?.productId || market?.productName || market?.listings?.[0]?.id || "--"));
    const acquiredAt = formatDateTime(card.acquiredAt);
    const acquisitionKind = card.acquisitionAddressKind === "legacy_wallet" ? "Legacy wallet" : (card.acquisitionAddressKind === "current_wallet" ? "Current wallet" : "");
    refs.detailMetrics.innerHTML = [
      ["Price", formatUSD(price)],
      ["Source", market?.source || activeSource || card.source || cardSourceLabel(card)],
      ["Product", marketProduct],
      ["Acquired", acquiredAt || "--"],
      acquisitionKind ? ["Acq source", acquisitionKind] : null,
      card.acquisitionTxHash ? ["Acq tx", shortHash(card.acquisitionTxHash)] : null,
      ["Catalog", card.catalogMatchStatus === "matched" ? (card.catalogMatchConfidence || "matched") : "unmatched"],
      card.catalogSetId || card.catalogCardCode ? ["DB card", [card.catalogSetId, card.catalogCardCode].filter(Boolean).join(" · ")] : null,
      ["Added", shortDate(card.addedAt || card.updatedAt || "")],
      ["Wallet", card.walletAddress ? shortWallet(card.walletAddress) : "--"],
      card.rawOwnerAddress && card.rawOwnerAddress !== card.walletAddress ? ["Source owner", shortWallet(card.rawOwnerAddress)] : null,
      ["Status", market?.listings?.some((listing) => listing.askUsd) ? "Listed" : "Tracked"],
    ].filter(Boolean).map(([label, value]) => `<div class="profile-mini-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
    const history = mergePriceHistory([], market?.priceHistory || []);
    drawChart(refs.cardChart, refs.cardChartNote, history, price, "No card history yet");
    refs.sourceTabs.innerHTML = marketSources(card).map((source) => `
      <button class="${source === activeSource ? "is-active" : ""}" type="button" data-market-source="${escapeAttr(source)}" aria-pressed="${source === activeSource ? "true" : "false"}">
        ${escapeHtml(source)}
      </button>
    `).join("");
    renderMarketSnapshot(card, market, activeSource, marketProduct);
    renderListings(market, activeSource);
    refs.detailActions.innerHTML = [
      card.url ? `<a class="profile-ghost-btn" href="${escapeAttr(card.url)}" target="_blank" rel="noreferrer"><iconify-icon icon="lucide:external-link"></iconify-icon><span>Open source</span></a>` : "",
      bscTxUrl(card.acquisitionTxHash) ? `<a class="profile-ghost-btn" href="${escapeAttr(bscTxUrl(card.acquisitionTxHash))}" target="_blank" rel="noreferrer"><iconify-icon icon="lucide:clock-3"></iconify-icon><span>取得交易</span></a>` : "",
      card.snkrProductId ? `<button class="profile-ghost-btn" type="button" data-refresh-snkr="${escapeAttr(card.id)}"><iconify-icon icon="lucide:refresh-cw"></iconify-icon><span>Refresh SNKR</span></button>` : "",
      state.activeCollection === "wallet" ? `<button class="profile-ghost-btn" type="button" data-import-wallet-card="${escapeAttr(card.id)}"><iconify-icon icon="lucide:copy-plus"></iconify-icon><span>加入 Own Profile</span></button>` : "",
    ].filter(Boolean).join("");
  }

  function renderLogin() {
    const label = isLoggedIn() ? (state.user.name || state.user.account) : "登入追蹤";
    refs.navLoginText.textContent = label;
    refs.loginName.value = state.user.account || state.user.name || "";
    refs.loginPassword.value = "";
    refs.loginWallet.value = state.user.wallet || "";
    if (state.user.wallet && !refs.walletInput.value) {
      refs.walletInput.value = state.user.wallet;
    }
  }

  function toolPanelTitle(panel) {
    if (panel === "wallet") return "連結錢包";
    if (panel === "search") return "查卡加入";
    if (panel === "scan") return "Card Scan Queue";
    if (panel === "settings") return "設定";
    return "Profile tools";
  }

  function setToolPanel(panel) {
    const value = ["wallet", "search", "scan", "settings"].includes(panel) ? panel : "";
    state.toolPanel = value;
    renderToolPanel();
  }

  function renderToolPanel() {
    const open = Boolean(state.toolPanel);
    refs.sideStack?.classList.toggle("is-open", open);
    if (refs.toolTitle) refs.toolTitle.textContent = toolPanelTitle(state.toolPanel);
    refs.sideStack?.querySelectorAll("[data-tool-section]").forEach((panel) => {
      panel.hidden = !open || panel.dataset.toolSection !== state.toolPanel;
    });
    refs.toolButtons?.forEach?.((button) => {
      button.classList.toggle("is-active", button.dataset.toolPanel === state.toolPanel);
    });
    if (refs.settingsMarket) {
      refs.settingsMarket.textContent = state.marketplace === "snkr-first" ? "SNKR first" : "Renaiss first";
    }
    if (refs.settingsAccount) {
      refs.settingsAccount.textContent = isLoggedIn() ? (state.user.name || state.user.account) : "未登入";
    }
  }

  function render() {
    renderLogin();
    renderSummary();
    renderCollectionControls();
    renderToolPanel();
    renderWallets();
    renderScanQueue();
    renderCards();
    renderDetail();
  }

  async function syncWallet(address) {
    if (!isLoggedIn()) {
      setStatus(refs.walletStatus, "請先用帳號密碼登入，再綁定錢包。", "error");
      openLoginModal();
      return;
    }
    const wallet = normalizeWallet(address);
    if (!wallet) {
      setStatus(refs.walletStatus, "請輸入有效的 0x 錢包地址。", "error");
      return;
    }
    setStatus(refs.walletStatus, `正在同步 ${shortWallet(wallet)}...`);
    try {
      const response = await fetch(apiUrl(`${WALLET_API_PATH}?address=${encodeURIComponent(wallet)}&limit=80`), {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `wallet sync failed: HTTP ${response.status}`);
      }
      const cards = Array.isArray(payload.cards) ? payload.cards.map((row) => normalizeWalletCard(row, wallet)) : [];
      const existing = state.wallets.filter((item) => normalizeWallet(item.address) !== wallet);
      state.walletCards = state.walletCards.filter((card) => normalizeWallet(card.walletAddress) !== wallet);
      state.wallets = [
        {
          address: wallet,
          label: payload.resolution?.username || payload.cards?.[0]?.owner_username || shortWallet(wallet),
          cardCount: cards.length,
          resolution: payload.resolution || {},
          syncedAt: nowIso(),
        },
        ...existing,
      ];
      state.user.wallet = wallet;
      updateAccountWallet(wallet);
      if (cards.length) {
        state.activeCollection = "wallet";
        upsertCards(cards, "wallet");
        const catalogMatched = Number(payload.resolution?.catalog_matched_count || 0);
        setStatus(refs.walletStatus, `已同步 ${cards.length} 張鏈上驗證持倉，${catalogMatched} 張已比對資料庫。`, "ok");
      } else {
        saveState();
        render();
        setStatus(refs.walletStatus, "這個錢包目前沒有可顯示的 Renaiss Wallet 持倉。", "ok");
      }
    } catch (error) {
      setStatus(refs.walletStatus, String(error?.message || error), "error");
    }
  }

  function walletCardForProfile(card) {
    return {
      ...card,
      id: `profile:${card.id || sourceKey(card)}`,
      origin: "wallet-import",
      source: "Renaiss Wallet",
      importedFromWallet: card.walletAddress || state.user.wallet || "",
      addedAt: nowIso(),
      updatedAt: nowIso(),
    };
  }

  function importWalletCardsToProfile(cardId = "") {
    if (!isLoggedIn()) {
      setStatus(refs.walletStatus, "請先登入再匯入 Own Profile。", "error");
      openLoginModal();
      return;
    }
    const rows = cardId ? state.walletCards.filter((card) => card.id === cardId) : state.walletCards;
    if (!rows.length) {
      setStatus(refs.walletStatus, "Renaiss Wallet 目前沒有可匯入的卡。", "error");
      return;
    }
    const imported = rows.map(walletCardForProfile);
    state.activeCollection = "profile";
    upsertCards(imported, "profile");
    setStatus(refs.walletStatus, `已匯入 ${imported.length} 張到 Own Profile。`, "ok");
  }

  function catalogResultsFromPayload(payload) {
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.cards)) return payload.cards;
    if (Array.isArray(payload?.matches)) return payload.matches;
    if (Array.isArray(payload?.collection)) return payload.collection;
    return [];
  }

  async function searchCatalog() {
    if (!isLoggedIn()) {
      setStatus(refs.catalogStatus, "請先登入，再把查卡結果加入 Own Profile。", "error");
      openLoginModal();
      return;
    }
    const rawQuery = refs.catalogQuery.value.trim();
    if (!rawQuery) {
      setStatus(refs.catalogStatus, "請輸入卡號、名稱或 SNKR product id。", "error");
      return;
    }
    const params = new URLSearchParams({
      game: refs.catalogGame.value || "onepiece",
      language: refs.catalogLanguage.value || "ja",
      limit: "8",
    });
    if (/^\d{4,}$/.test(rawQuery)) {
      params.set("snkr_product_id", rawQuery);
    } else {
      params.set("q", rawQuery);
    }
    setStatus(refs.catalogStatus, "正在查詢卡牌文字索引...");
    refs.catalogResults.innerHTML = "";
    try {
      const response = await fetch(apiUrl(`${CATALOG_API_PATH}?${params.toString()}`), {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `catalog search failed: HTTP ${response.status}`);
      }
      const cards = catalogResultsFromPayload(payload).map((row) => normalizeCatalogCard(row, "catalog"));
      renderCatalogResults(cards);
      setStatus(refs.catalogStatus, cards.length ? `找到 ${cards.length} 筆候選。` : "沒有找到候選結果。", cards.length ? "ok" : "");
    } catch (error) {
      setStatus(refs.catalogStatus, String(error?.message || error), "error");
    }
  }

  function renderCatalogResults(cards) {
    if (!cards.length) {
      refs.catalogResults.innerHTML = "";
      return;
    }
    refs.catalogResults.innerHTML = cards.map((card, index) => `
      <div class="profile-catalog-card">
        ${card.imageUrl ? `<img src="${escapeAttr(card.imageUrl)}" alt="" loading="lazy" />` : `<img src="./assets/renaiss-logo-alpha-cropped.png" alt="" />`}
        <div>
          <strong>${escapeHtml(card.name)}</strong>
          <span>${escapeHtml([card.setName, card.cardCode, card.language, card.snkrProductId ? `SNKR ${card.snkrProductId}` : ""].filter(Boolean).join(" · "))}</span>
        </div>
        <button type="button" data-add-catalog="${index}">加入</button>
      </div>
    `).join("");
    refs.catalogResults.querySelectorAll("[data-add-catalog]").forEach((button) => {
      button.addEventListener("click", () => {
        const card = cards[Number(button.dataset.addCatalog) || 0];
        if (!card) return;
        state.activeCollection = "profile";
        upsertCards([card], "profile");
        setStatus(refs.catalogStatus, `已加入 ${card.name}。`, "ok");
      });
    });
  }

  async function hydrateSNKR(cardId) {
    const card = findCard(cardId);
    if (!card?.snkrProductId || state.hydrating.has(cardId)) return;
    state.hydrating.add(cardId);
    try {
      const response = await fetch(apiUrl(`${SNKR_HISTORY_PATH}?product_id=${encodeURIComponent(card.snkrProductId)}`), {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `SNKR history failed: HTTP ${response.status}`);
      }
      const trades = Array.isArray(payload.trades) ? payload.trades : [];
      const points = dailyMedianPoints(trades);
      const latest = points[points.length - 1]?.price || card.marketPriceUsd || 0;
      const target = findCard(cardId);
      if (target) {
        target.marketPriceUsd = latest;
        target.priceHistory = mergePriceHistory(target.priceHistory, points);
        target.markets = {
          ...(target.markets || {}),
          SNKR: {
            ...((target.markets || {}).SNKR || {}),
            source: "SNKR",
            productId: target.snkrProductId,
            marketPriceUsd: latest,
            priceHistory: target.priceHistory,
            rawTrades: trades,
          },
        };
        target.updatedAt = nowIso();
        recordPortfolioSnapshot();
        saveState();
        render();
      }
    } catch (error) {
      console.warn("[profile] SNKR hydrate failed", error);
    } finally {
      state.hydrating.delete(cardId);
    }
  }

  function dailyMedianPoints(trades) {
    const byDay = new Map();
    trades.forEach((trade) => {
      const price = Number(trade?.price_usd || trade?.priceUSD || 0);
      const date = String(trade?.date || trade?.tradedAt || "");
      const parsed = Date.parse(date);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(parsed)) return;
      const key = new Date(parsed).toISOString().slice(0, 10);
      const list = byDay.get(key) || [];
      list.push(price);
      byDay.set(key, list);
    });
    return Array.from(byDay.entries()).map(([day, prices]) => {
      const sorted = prices.sort((left, right) => left - right);
      const mid = Math.floor(sorted.length / 2);
      const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return {
        date: new Date(`${day}T00:00:00.000Z`).toISOString(),
        label: shortDate(day),
        price: Math.round(value),
        sourceCount: prices.length,
      };
    }).sort((left, right) => Date.parse(left.date) - Date.parse(right.date)).slice(-365);
  }

  function importScan(index) {
    if (!isLoggedIn()) {
      setStatus(refs.scanStatus, "請先登入，再匯入掃描結果。", "error");
      openLoginModal();
      return;
    }
    const item = state.scanQueue[index];
    if (!item) return;
    const card = normalizeScanCard(item);
    state.activeCollection = "profile";
    upsertCards([card], "profile");
    const next = state.scanQueue.filter((_, itemIndex) => itemIndex !== index);
    writeScanQueue(next);
    render();
    setStatus(refs.scanStatus, `已匯入 ${card.name}。`, "ok");
  }

  function openLoginModal() {
    refs.loginModal.hidden = false;
    refs.loginModal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => refs.loginName.focus(), 40);
  }

  function closeLoginModal() {
    refs.loginModal.hidden = true;
    refs.loginModal.setAttribute("aria-hidden", "true");
  }

  function bindEvents() {
    refs.navLogin?.addEventListener("click", openLoginModal);
    refs.loginClose?.addEventListener("click", closeLoginModal);
    refs.loginModal?.addEventListener("click", (event) => {
      if (event.target === refs.loginModal) closeLoginModal();
    });
    refs.loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const wallet = normalizeWallet(refs.loginWallet.value);
      if (refs.loginWallet.value.trim() && !wallet) {
        setStatus(refs.loginStatus, "請輸入有效的 0x 錢包地址，或留空只登入帳號。", "error");
        return;
      }
      try {
        const account = await loginOrCreateAccount(refs.loginName.value, refs.loginPassword.value, wallet);
        state.user = {
          name: account.name,
          account: account.account,
          wallet: account.wallet || "",
          isAuthenticated: true,
        };
        loadAccountProfileData(account.account);
        if (state.user.wallet) {
          refs.walletInput.value = state.user.wallet;
        } else {
          refs.walletInput.value = "";
        }
        saveState();
        render();
        setStatus(refs.loginStatus, "已登入本地追蹤帳號。", "ok");
        if (state.user.wallet) void syncWallet(state.user.wallet);
        window.setTimeout(closeLoginModal, 450);
      } catch (error) {
        setStatus(refs.loginStatus, String(error?.message || error), "error");
      }
    });
    refs.logoutButton?.addEventListener("click", () => {
      saveAccountProfileData();
      state.user = { name: "", account: "", wallet: "", isAuthenticated: false };
      refs.walletInput.value = "";
      clearProfileData();
      saveState();
      render();
      setStatus(refs.loginStatus, "已登出。", "ok");
    });
    refs.toolButtons?.forEach?.((button) => {
      button.addEventListener("click", () => {
        setToolPanel(button.dataset.toolPanel || "");
      });
    });
    refs.toolClose?.addEventListener("click", () => {
      setToolPanel("");
    });
    refs.heroSync?.addEventListener("click", () => {
      setToolPanel("wallet");
    });
    refs.walletForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void syncWallet(refs.walletInput.value);
    });
    refs.collectionRow?.addEventListener("click", (event) => {
      const collectionButton = event.target.closest("[data-collection]");
      if (collectionButton) {
        state.activeCollection = collectionButton.dataset.collection === "wallet" ? "wallet" : "profile";
        ensureSelection();
        saveState();
        render();
        return;
      }
      const importButton = event.target.closest("[data-import-wallet-all]");
      if (importButton) {
        importWalletCardsToProfile();
      }
    });
    refs.syncCurrent?.addEventListener("click", () => {
      const wallet = normalizeWallet(refs.walletInput.value) || state.user.wallet || state.wallets[0]?.address;
      if (wallet) void syncWallet(wallet);
      else setStatus(refs.walletStatus, "先輸入一個錢包地址。", "error");
    });
    refs.clearWallet?.addEventListener("click", () => {
      refs.walletInput.value = "";
      setStatus(refs.walletStatus, "");
    });
    refs.walletList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sync-wallet]");
      if (!button) return;
      refs.walletInput.value = button.dataset.syncWallet || "";
      void syncWallet(button.dataset.syncWallet);
    });
    refs.catalogForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void searchCatalog();
    });
    refs.addOp16?.addEventListener("click", () => {
      refs.catalogQuery.value = "OP16-001";
      refs.catalogGame.value = "onepiece";
      refs.catalogLanguage.value = "ja";
      void searchCatalog();
    });
    refs.scanQueue?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-import-scan]");
      if (!button) return;
      importScan(Number(button.dataset.importScan) || 0);
    });
    refs.cardGrid?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-card-id]");
      if (!button) return;
      state.selectedCardId = button.dataset.cardId || "";
      state.detailOpen = true;
      saveState();
      render();
      refs.detailPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    refs.filterRow?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.filter = button.dataset.filter || "all";
      saveState();
      render();
    });
    refs.gameFilterRow?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-game-filter]");
      if (!button) return;
      state.gameFilter = ["all", "pokemon", "one-piece"].includes(button.dataset.gameFilter) ? button.dataset.gameFilter : "all";
      ensureSelection();
      saveState();
      render();
    });
    refs.viewRow?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (!button) return;
      state.view = button.dataset.view === "grid" ? "grid" : "list";
      saveState();
      render();
    });
    refs.sortSelect?.addEventListener("change", () => {
      state.sort = refs.sortSelect.value || "newest";
      saveState();
      render();
    });
    refs.marketSelect?.addEventListener("change", () => {
      state.marketplace = refs.marketSelect.value === "snkr-first" ? "snkr-first" : "renaiss-first";
      recordPortfolioSnapshot();
      saveState();
      render();
    });
    const handleRangeClick = (event) => {
      const button = event.target.closest("[data-range]");
      if (!button) return;
      state.range = RANGE_DAYS[button.dataset.range] ? button.dataset.range : "1y";
      saveState();
      render();
    };
    refs.rangeRow?.addEventListener("click", handleRangeClick);
    refs.cardRangeRow?.addEventListener("click", handleRangeClick);
    refs.sourceTabs?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-market-source]");
      if (!button) return;
      const card = findCard(state.selectedCardId);
      const source = button.dataset.marketSource || "";
      if (!setSelectedMarketSource(card, source)) return;
      saveState();
      render();
      if (source === "SNKR" && card?.snkrProductId) void hydrateSNKR(card.id);
    });
    refs.detailRemove?.addEventListener("click", () => {
      if (!state.selectedCardId) return;
      state.cards = state.cards.filter((card) => card.id !== state.selectedCardId);
      state.selectedCardId = state.cards[0]?.id || "";
      state.detailOpen = false;
      recordPortfolioSnapshot();
      saveState();
      render();
    });
    refs.detailClose?.addEventListener("click", () => {
      state.detailOpen = false;
      render();
    });
    refs.detailActions?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-refresh-snkr]");
      if (button) {
        void hydrateSNKR(button.dataset.refreshSnkr);
        return;
      }
      const importButton = event.target.closest("[data-import-wallet-card]");
      if (importButton) {
        importWalletCardsToProfile(importButton.dataset.importWalletCard || "");
      }
    });
    window.addEventListener("storage", (event) => {
      if (event.key !== SCAN_QUEUE_KEY) return;
      state.scanQueue = readScanQueue();
      renderScanQueue();
    });
    window.addEventListener("resize", () => {
      renderDetail();
    });
  }

  loadState();
  bindEvents();
  render();
})();
