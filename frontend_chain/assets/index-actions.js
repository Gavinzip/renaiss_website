    function setupIntelActions() {
      const analyzeBtn = document.getElementById("intel-analyze-btn");
      const syncBtn = document.getElementById("intel-sync-btn");
      const input = document.getElementById("intel-url-input");
      const loginButtons = [
        document.getElementById("intel-login-btn"),
        document.getElementById("nav-intel-login-btn"),
      ].filter(Boolean);
      const logoutButtons = [
        document.getElementById("intel-logout-btn"),
        document.getElementById("nav-intel-logout-btn"),
      ].filter(Boolean);
      const adminOpenBtn = document.getElementById("nav-admin-monitor-btn");
      const authModal = document.getElementById("intel-auth-modal");
      const adminModal = document.getElementById("intel-admin-modal");
      const feedbackModal = document.getElementById("intel-feedback-modal");
      const feedbackForm = document.getElementById("intel-feedback-form");
      const authForm = document.getElementById("intel-auth-form");
      const authSubmit = document.getElementById("intel-auth-submit");
      const adminRefreshBtn = document.getElementById("intel-admin-refresh");
      const adminSyncNowBtn = document.getElementById("intel-admin-sync-now");
      const adminBackupRunBtn = document.getElementById("intel-admin-backup-run");
      const adminRestoreRunBtn = document.getElementById("intel-admin-restore-run");
      const xSourceForm = document.getElementById("intel-admin-x-source-form");
      const xSourceInput = document.getElementById("intel-admin-x-source-input");
      const xSourcePokemonInput = document.getElementById("intel-admin-x-source-pokemon");
      const xSourceList = document.getElementById("intel-admin-x-source-list");
      const xSourceResult = document.getElementById("intel-admin-x-source-result");

      const setXSourceResult = (text, mode = "") => {
        if (!xSourceResult) return;
        xSourceResult.classList.remove("is-pending", "is-ok", "is-error");
        if (mode === "pending") xSourceResult.classList.add("is-pending");
        if (mode === "ok") xSourceResult.classList.add("is-ok");
        if (mode === "error") xSourceResult.classList.add("is-error");
        xSourceResult.textContent = String(text || "");
      };
      const secretLine = document.getElementById("intel-auth-stealth-line");
      const cardWraps = Array.from(document.querySelectorAll(".intel-grid"));
      const masterStage = document.getElementById("intel-master-stage");
      const masterRail = document.getElementById("intel-master-rail");
      const detailModal = document.getElementById("intel-detail-modal");
      const pokemonNewsRefreshBtn = document.getElementById("pokemon-news-refresh-btn");
      const pokemonNewsList = document.getElementById("pokemon-news-list");
      if (!analyzeBtn || !syncBtn || !input) return;

      const disableApiActions = location.protocol === "file:";
      document.body.dataset.intelApiDisabled = disableApiActions ? "1" : "0";
      if (disableApiActions) {
        analyzeBtn.disabled = true;
        syncBtn.disabled = true;
        if (pokemonNewsRefreshBtn) pokemonNewsRefreshBtn.disabled = true;
        setIntelMessage("目前是 file:// 模式。請改用 `python scripts/ai_intel_server.py --port 8787` 後從 http://127.0.0.1:8787 開啟。", "error");
      }

      const readTimelineEditorPayload = (btn) => {
        const host = btn?.closest?.("article, .intel-master-card, .intel-card");
        if (!host) return {};
        const startEl = host.querySelector('input[data-intel-timeline-start]');
        const endEl = host.querySelector('input[data-intel-timeline-end]');
        return {
          timeline_date: String(startEl?.value || "").trim(),
          timeline_end_date: String(endEl?.value || "").trim(),
        };
      };

      const readFeedbackTopicLabels = () => {
        const checked = Array.from(document.querySelectorAll("[data-intel-feedback-section-option]:checked"))
          .map((node) => String(node?.value || "").trim().toLowerCase())
          .filter(Boolean);
        const labels = Array.from(new Set(checked));
        if (labels.includes("other")) return ["other"];
        return labels;
      };

      const syncFeedbackOtherChoice = (changedNode) => {
        const nodes = Array.from(document.querySelectorAll("[data-intel-feedback-section-option]"));
        const changedValue = String(changedNode?.value || "").trim().toLowerCase();
        if (changedValue === "other" && changedNode.checked) {
          nodes.forEach((node) => {
            if (String(node.value || "").trim().toLowerCase() !== "other") node.checked = false;
          });
          return;
        }
        if (changedValue && changedValue !== "other" && changedNode?.checked) {
          nodes.forEach((node) => {
            if (String(node.value || "").trim().toLowerCase() === "other") node.checked = false;
          });
        }
      };

      loginButtons.forEach((loginBtn) => {
        if (loginBtn.dataset.boundAuth) return;
        loginBtn.dataset.boundAuth = "1";
        loginBtn.addEventListener("click", () => {
          if (disableApiActions) return;
          openIntelAuthModal();
          if (intelCanEdit()) refreshIntelAdminStatus();
        });
      });

      if (adminOpenBtn && !adminOpenBtn.dataset.boundAdminOpen) {
        adminOpenBtn.dataset.boundAdminOpen = "1";
        adminOpenBtn.addEventListener("click", async () => {
          if (!intelCanEdit()) {
            openIntelAuthModal();
            setIntelMessage("請先登入管理員帳號後再查看 AI 監控。", "error");
            return;
          }
          openIntelAdminModal();
          await refreshIntelAdminStatus();
        });
      }

      logoutButtons.forEach((logoutBtn) => {
        if (logoutBtn.dataset.boundAuth) return;
        logoutBtn.dataset.boundAuth = "1";
        logoutBtn.addEventListener("click", async () => {
          if (disableApiActions) return;
          logoutButtons.forEach((btn) => { btn.disabled = true; });
          try {
            await submitIntelLogout();
            setIntelMessage("已登出管理模式。", "ok");
          } catch (error) {
            setIntelMessage(`登出失敗：${error.message}`, "error");
          } finally {
            logoutButtons.forEach((btn) => { btn.disabled = false; });
            updateIntelAuthUi();
          }
        });
      });

      const runHiddenLogout = async () => {
        if (disableApiActions) return;
        if (!intelAuthState.authenticated) return;
        logoutButtons.forEach((btn) => { btn.disabled = true; });
        try {
          await submitIntelLogout();
          setIntelMessage("已登出管理模式。", "ok");
        } catch (error) {
          setIntelMessage(`登出失敗：${error.message}`, "error");
        } finally {
          logoutButtons.forEach((btn) => { btn.disabled = false; });
          updateIntelAuthUi();
        }
      };

      if (secretLine && !secretLine.dataset.boundSecretLine) {
        secretLine.dataset.boundSecretLine = "1";
        let secretTapCount = 0;
        let lastTapAt = 0;
        secretLine.addEventListener("click", async (event) => {
          if (disableApiActions) return;
          const interactive = event.target.closest("a,button,input,textarea,label");
          if (interactive) return;
          const now = Date.now();
          if (now - lastTapAt > 1800) secretTapCount = 0;
          secretTapCount += 1;
          lastTapAt = now;
          if (secretTapCount < 3) return;
          secretTapCount = 0;
          if (intelAuthState.authenticated) {
            const shouldLogout = window.confirm("已登入管理模式，要登出嗎？");
            if (shouldLogout) await runHiddenLogout();
            else {
              openIntelAuthModal();
              refreshIntelAdminStatus();
            }
            return;
          }
          openIntelAuthModal();
          if (intelCanEdit()) refreshIntelAdminStatus();
          setIntelMessage("已開啟管理登入視窗。", "");
        });
      }

      if (!document.body.dataset.boundSecretHotkey) {
        document.body.dataset.boundSecretHotkey = "1";
        document.addEventListener("keydown", async (event) => {
          const target = event.target;
          const tag = String(target?.tagName || "").toUpperCase();
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
          const hasSecretMod = event.metaKey || event.altKey;
          if (!hasSecretMod || !event.shiftKey) return;
          if (event.code === "KeyA") {
            event.preventDefault();
            if (disableApiActions) return;
            openIntelAuthModal();
            if (intelCanEdit()) refreshIntelAdminStatus();
            setIntelMessage("已開啟管理登入視窗。", "");
            return;
          }
          if (event.code === "KeyL") {
            event.preventDefault();
            if (!intelAuthState.authenticated) return;
            const shouldLogout = window.confirm("要登出管理模式嗎？");
            if (!shouldLogout) return;
            await runHiddenLogout();
          }
        });
      }

      if (authModal && !authModal.dataset.boundAuth) {
        authModal.dataset.boundAuth = "1";
        authModal.addEventListener("click", (event) => {
          const closeBtn = event.target.closest("[data-intel-auth-close]");
          if (closeBtn || event.target === authModal) {
            closeIntelAuthModal(false);
          }
        });
      }

      if (adminModal && !adminModal.dataset.boundAdminModal) {
        adminModal.dataset.boundAdminModal = "1";
        adminModal.addEventListener("click", (event) => {
          const closeBtn = event.target.closest("[data-intel-admin-close]");
          if (closeBtn || event.target === adminModal) {
            closeIntelAdminModal();
          }
        });
      }

      if (feedbackModal && !feedbackModal.dataset.boundFeedbackModal) {
        feedbackModal.dataset.boundFeedbackModal = "1";
        feedbackModal.addEventListener("click", (event) => {
          const closeBtn = event.target.closest("[data-intel-feedback-close],[data-intel-feedback-cancel]");
          if (closeBtn || event.target === feedbackModal) {
            closeIntelFeedbackModal(null);
          }
        });
      }

      if (feedbackForm && !feedbackForm.dataset.boundFeedbackForm) {
        feedbackForm.dataset.boundFeedbackForm = "1";
        feedbackForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const mode = String(feedbackModal?.dataset.mode || "feedback");
          const cardTypeEl = document.getElementById("intel-feedback-card-type");
          const reasonEl = document.getElementById("intel-feedback-reason");
          const cardType = String(cardTypeEl?.value || "").trim().toLowerCase();
          const topicLabels = readFeedbackTopicLabels();
          const reason = String(reasonEl?.value || "").trim();
          if (mode === "exclude") {
            closeIntelFeedbackModal({ mode: "exclude", reason });
            return;
          }
          const cardTypeLabels = new Set(["event", "feature", "announcement", "market", "trend", "report", "insight"]);
          const sectionLabels = new Set(["events", "official", "sbt", "pokemon", "collectibles", "alpha", "guides", "community", "other"]);
          if (!cardType && !topicLabels.length) {
            setIntelMessage("請至少選擇卡片類型，並保留至少一個分區；若無法分類請選「無」。", "error");
            return;
          }
          if (cardType && !cardTypeLabels.has(cardType)) {
            setIntelMessage("卡片類型無效，請重新選擇。", "error");
            return;
          }
          if (!topicLabels.length) {
            setIntelMessage("分區至少要保留一個；若不屬於任何分區請選「無」。", "error");
            return;
          }
          if (topicLabels.some((label) => !sectionLabels.has(label))) {
            setIntelMessage("分區無效，請重新選擇。", "error");
            return;
          }
          closeIntelFeedbackModal({ mode: "feedback", cardType, topicLabels, reason });
        });
      }

      document.querySelectorAll("[data-intel-feedback-section-option]").forEach((node) => {
        if (node.dataset.boundFeedbackSection) return;
        node.dataset.boundFeedbackSection = "1";
        node.addEventListener("change", () => syncFeedbackOtherChoice(node));
      });

      if (authForm && !authForm.dataset.boundAuth) {
        authForm.dataset.boundAuth = "1";
        authForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (disableApiActions) return;
          const userInput = document.getElementById("intel-auth-username");
          const passInput = document.getElementById("intel-auth-password");
          const username = String(userInput?.value || "").trim();
          const password = String(passInput?.value || "");
          if (!username || !password) {
            setIntelMessage("請輸入帳號與密碼。", "error");
            return;
          }
          if (authSubmit) authSubmit.disabled = true;
          try {
            await submitIntelLogin(username, password);
            closeIntelAuthModal(true);
            setIntelMessage("已登入管理模式，現在可執行修改操作。", "ok");
            refreshIntelAdminStatus();
          } catch (error) {
            setIntelMessage(`登入失敗：${error.message}`, "error");
          } finally {
            if (authSubmit) authSubmit.disabled = false;
            updateIntelAuthUi();
          }
        });
      }

      if (adminRefreshBtn && !adminRefreshBtn.dataset.boundRefresh) {
        adminRefreshBtn.dataset.boundRefresh = "1";
        adminRefreshBtn.addEventListener("click", async () => {
          if (!intelCanEdit()) return;
          adminRefreshBtn.disabled = true;
          try {
            await refreshIntelAdminStatus();
          } finally {
            adminRefreshBtn.disabled = false;
          }
        });
      }

      if (adminBackupRunBtn && !adminBackupRunBtn.dataset.boundBackupRun) {
        adminBackupRunBtn.dataset.boundBackupRun = "1";
        adminBackupRunBtn.addEventListener("click", async () => {
          if (!intelCanEdit()) {
            openIntelAuthModal();
            setIntelMessage("請先登入管理員帳號後再執行備份。", "error");
            return;
          }
          if (!window.confirm("確定要手動備份並上傳目前網站資料嗎？如果 repo / PAT 已設定，這會 push 到備份 repo。")) return;
          adminBackupRunBtn.disabled = true;
          adminBackupRunBtn.textContent = "備份啟動中...";
          try {
            await triggerWebsiteBackup();
            setIntelMessage("已啟動背景備份，請在 AI 監控面板查看進度。", "ok");
            await refreshIntelAdminStatus();
          } catch (error) {
            setIntelMessage(`備份啟動失敗：${error.message}`, "error");
          } finally {
            adminBackupRunBtn.disabled = false;
            adminBackupRunBtn.textContent = "手動備份上傳";
          }
        });
      }

      if (adminRestoreRunBtn && !adminRestoreRunBtn.dataset.boundRestoreRun) {
        adminRestoreRunBtn.dataset.boundRestoreRun = "1";
        adminRestoreRunBtn.addEventListener("click", async () => {
          if (!intelCanEdit()) {
            openIntelAuthModal();
            setIntelMessage("請先登入管理員帳號後再執行還原。", "error");
            return;
          }
          if (!window.confirm("確定要從 Git 抓資料並覆蓋目前伺服器 data 嗎？這會直接覆蓋現有檔案。")) return;
          adminRestoreRunBtn.disabled = true;
          adminRestoreRunBtn.textContent = "還原中...";
          try {
            const restore = await triggerWebsiteRestore(true);
            await refreshIntelAdminStatus();
            if (restore?.ok === false) {
              const detail = String(restore?.error || restore?.reason || "unknown_error");
              setIntelMessage(`還原失敗：${detail}`, "error");
            } else if (restore?.restored) {
              setIntelMessage("已從 Git 還原並覆蓋伺服器 data。", "ok");
            } else {
              setIntelMessage(`未執行還原：${String(restore?.reason || "無變更")}`, "");
            }
          } catch (error) {
            setIntelMessage(`還原請求失敗：${error.message}`, "error");
          } finally {
            adminRestoreRunBtn.disabled = false;
            adminRestoreRunBtn.textContent = "從 Git 還原覆蓋";
          }
        });
      }

      if (xSourceForm && !xSourceForm.dataset.boundXSourceForm) {
        xSourceForm.dataset.boundXSourceForm = "1";
        xSourceForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!intelCanEdit()) {
            openIntelAuthModal();
            setXSourceResult("新增失敗：請先登入管理員帳號。", "error");
            setIntelMessage("請先登入管理員帳號後再新增追蹤用戶。", "error");
            return;
          }
          const account = String(xSourceInput?.value || "").trim();
          if (!account) {
            setXSourceResult("新增失敗：請輸入 X username 或個人頁 URL。", "error");
            setIntelMessage("請輸入要追蹤的 X username 或個人頁 URL。", "error");
            return;
          }
          const submitBtn = xSourceForm.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;
          try {
            const action = xSourcePokemonInput?.checked ? "add_pokemon" : "add";
            setXSourceResult(action === "add_pokemon" ? `送出中：正在新增 ${account} 並標記為寶可夢來源...` : `送出中：正在新增 ${account} 到一般 X 追蹤清單...`, "pending");
            const source = await updateIntelXSource(action, account);
            const normalizedAccount = String(source?.account || account).trim();
            const label = normalizedAccount ? `@${normalizedAccount}` : account;
            const changed = source?.changed === true;
            if (xSourceInput) xSourceInput.value = "";
            if (xSourcePokemonInput) xSourcePokemonInput.checked = false;
            const okMessage = changed
              ? (action === "add_pokemon"
                ? `新增成功：${label} 已加入追蹤清單，並設為寶可夢來源。`
                : `新增成功：${label} 已加入一般 X 追蹤清單，之後會進完整分析流程。`)
              : (action === "add_pokemon"
                ? `沒有變更：${label} 已在追蹤清單，且已是寶可夢來源。`
                : `沒有變更：${label} 已在一般 X 追蹤清單。`);
            setXSourceResult(okMessage, "ok");
            setIntelMessage(okMessage, "ok");
            await refreshIntelAdminStatus();
          } catch (error) {
            const failMessage = `新增追蹤來源失敗：${error.message}`;
            setXSourceResult(failMessage, "error");
            setIntelMessage(failMessage, "error");
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      }

      if (xSourceList && !xSourceList.dataset.boundXSourceRemove) {
        xSourceList.dataset.boundXSourceRemove = "1";
        xSourceList.addEventListener("click", async (event) => {
          const pokemonBtn = event.target.closest("[data-intel-source-pokemon-action]");
          if (pokemonBtn) {
            if (!intelCanEdit()) {
              openIntelAuthModal();
              setXSourceResult("更新失敗：請先登入管理員帳號。", "error");
              setIntelMessage("請先登入管理員帳號後再更新來源分區。", "error");
              return;
            }
            const account = String(pokemonBtn.dataset.intelSourceAccount || "").trim();
            const action = String(pokemonBtn.dataset.intelSourcePokemonAction || "").trim();
            if (!account || !action) return;
            pokemonBtn.disabled = true;
            try {
              setXSourceResult(`送出中：正在更新 @${account} 的寶可夢來源設定...`, "pending");
              const source = await updateIntelXSource(action, account);
              const changed = source?.changed === true;
              const okMessage = changed
                ? (action === "add_pokemon" ? `更新成功：@${account} 已設為寶可夢來源。` : `更新成功：@${account} 已取消寶可夢來源。`)
                : (action === "add_pokemon" ? `沒有變更：@${account} 已是寶可夢來源。` : `沒有變更：@${account} 原本就不是寶可夢來源。`);
              setXSourceResult(okMessage, "ok");
              setIntelMessage(okMessage, "ok");
              await refreshIntelAdminStatus();
            } catch (error) {
              const failMessage = `更新來源分區失敗：${error.message}`;
              setXSourceResult(failMessage, "error");
              setIntelMessage(failMessage, "error");
            } finally {
              pokemonBtn.disabled = false;
            }
            return;
          }
          const btn = event.target.closest("[data-intel-source-remove]");
          if (!btn) return;
          if (!intelCanEdit()) {
            openIntelAuthModal();
            setXSourceResult("取消追蹤失敗：請先登入管理員帳號。", "error");
            setIntelMessage("請先登入管理員帳號後再取消追蹤。", "error");
            return;
          }
          const account = String(btn.dataset.intelSourceRemove || "").trim();
          if (!account) return;
          if (!window.confirm(`確定要取消追蹤 @${account} 嗎？這只影響下一次 sync 的抓取來源，不會刪除既有卡片。`)) return;
          btn.disabled = true;
          try {
            setXSourceResult(`送出中：正在取消追蹤 @${account}...`, "pending");
            const source = await updateIntelXSource("remove", account);
            const okMessage = source?.changed === true
              ? `取消成功：@${account} 已從追蹤清單移除。`
              : `沒有變更：@${account} 不在追蹤清單中。`;
            setXSourceResult(okMessage, "ok");
            setIntelMessage(okMessage, "ok");
            await refreshIntelAdminStatus();
          } catch (error) {
            const failMessage = `取消追蹤失敗：${error.message}`;
            setXSourceResult(failMessage, "error");
            setIntelMessage(failMessage, "error");
          } finally {
            btn.disabled = false;
          }
        });
      }

      fetchIntelAuthState().then(() => {
        if (intelFeedCache) renderIntelFeed(intelFeedCache);
        else updateIntelAuthUi();
      });

      analyzeBtn.addEventListener("click", async () => {
        if (!intelCanEdit()) {
          openIntelAuthModal();
          setIntelMessage("請先登入管理員帳號後再分析貼文。", "error");
          return;
        }
        const url = String(input.value || "").trim();
        if (!/^https?:\/\/(x|twitter)\.com\//i.test(url)) {
          setIntelMessage("請貼上有效的 X / Twitter 貼文網址。", "error");
          return;
        }
        analyzeBtn.disabled = true;
        setIntelMessage("已送出背景分析工作，會先進入貼文分析流程（可直接刷新頁面）。", "");
        try {
          const data = await postIntel("/api/intel/analyze-url", { url });
          const jobId = String(data?.job?.id || "").trim();
          if (!jobId) throw new Error("無法取得背景工作 ID");
          input.value = "";
          startAnalyzePolling(jobId);
        } catch (error) {
          setIntelMessage(`分析失敗：${error.message}（確認後端 API 可連線）`, "error");
        } finally {
          analyzeBtn.disabled = false;
        }
      });

      async function runIntelSyncNow() {
        if (!intelCanEdit()) {
          openIntelAuthModal();
          setIntelMessage("請先登入管理員帳號後再同步。", "error");
          return false;
        }
        syncBtn.disabled = true;
        if (adminSyncNowBtn) {
          adminSyncNowBtn.disabled = true;
          adminSyncNowBtn.textContent = "掃描中...";
        }
        stopAnalyzePolling(false);
        setIntelMessage("正在同步最近 30 天資料...", "");
        startIntelAdminPolling();
        window.setTimeout(() => {
          refreshIntelAdminStatus();
        }, 700);
        try {
          await postIntel("/api/intel/sync", { days: 30 });
          await refreshIntelFeedForCurrentLang();
          refreshIntelAdminStatus();
          setIntelMessage("同步完成。", "ok");
          return true;
        } catch (error) {
          setIntelMessage(`同步失敗：${error.message}（確認後端 API 可連線）`, "error");
          return false;
        } finally {
          syncBtn.disabled = false;
          if (adminSyncNowBtn) {
            adminSyncNowBtn.disabled = false;
            adminSyncNowBtn.textContent = "立即掃描（30 天）";
          }
        }
      }

      syncBtn.addEventListener("click", async () => {
        await runIntelSyncNow();
      });

      if (adminSyncNowBtn && !adminSyncNowBtn.dataset.boundSyncNow) {
        adminSyncNowBtn.dataset.boundSyncNow = "1";
        adminSyncNowBtn.addEventListener("click", async () => {
          if (!intelCanEdit()) {
            openIntelAuthModal();
            setIntelMessage("請先登入管理員帳號後再啟動掃描。", "error");
            return;
          }
          await runIntelSyncNow();
        });
      }

      if (pokemonNewsRefreshBtn) {
        pokemonNewsRefreshBtn.addEventListener("click", async () => {
          pokemonNewsRefreshBtn.disabled = true;
          try {
            await refreshPokemonNews(true);
          } catch (error) {
            const metaEl = document.getElementById("pokemon-news-meta");
            if (metaEl) metaEl.textContent = `來源：MiniMax NewsAgent · 更新失敗：${error.message}`;
          } finally {
            pokemonNewsRefreshBtn.disabled = false;
          }
        });
      }

      if (pokemonNewsList && !pokemonNewsList.dataset.boundOpen) {
        pokemonNewsList.dataset.boundOpen = "1";
        pokemonNewsList.addEventListener("click", (event) => {
          const interactive = event.target.closest("a,button,input,textarea,label");
          if (interactive) return;
          const card = event.target.closest(".pokemon-news-card[data-pokemon-news-index]");
          if (!card) return;
          const idx = Number(card.dataset.pokemonNewsIndex || "-1");
          if (!Number.isInteger(idx) || idx < 0) return;
          openPokemonNewsDetailModal(idx);
        });
      }

      cardWraps.forEach((cardsWrap) => {
        if (!cardsWrap || cardsWrap.dataset.boundPick) return;
        cardsWrap.dataset.boundPick = "1";
        cardsWrap.addEventListener("click", async (event) => {
          const btn = event.target.closest("button[data-intel-action][data-intel-id]");
          if (btn) {
            const action = String(btn.dataset.intelAction || "").trim();
            const id = String(btn.dataset.intelId || "").trim();
            const hintLabel = String(btn.dataset.intelLabel || "").trim();
            if (!id || !action) return;
            const extra = action === "timeline-save" ? readTimelineEditorPayload(btn) : {};
            btn.disabled = true;
            try {
              await handleIntelAction(action, id, hintLabel, extra);
            } catch (error) {
              setIntelMessage(`設定失敗：${error.message}`, "error");
            } finally {
              btn.disabled = false;
            }
            return;
          }
          const interactive = event.target.closest("a,button,input,textarea,label");
          if (interactive) return;
          const cardNode = event.target.closest(".intel-card[data-intel-card-id]");
          if (!cardNode) return;
          openIntelDetailModal(cardNode.dataset.intelCardId || "");
        });
      });

      if (detailModal && !detailModal.dataset.boundModal) {
        detailModal.dataset.boundModal = "1";
        detailModal.addEventListener("click", (event) => {
          const closeBtn = event.target.closest("[data-intel-detail-close]");
          if (closeBtn || event.target === detailModal) {
            closeIntelDetailModal();
          }
        });
        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            closeIntelDetailModal();
            closeIntelAuthModal(false);
            closeIntelAdminModal();
            closeIntelFeedbackModal(null);
          }
        });
      }

      if (masterRail && !masterRail.dataset.boundMaster) {
        masterRail.dataset.boundMaster = "1";
        masterRail.addEventListener("click", (event) => {
          clearFlingTail();
          const chip = event.target.closest("button[data-master-index]");
          if (!chip) return;
          const idx = Number(chip.dataset.masterIndex || "-1");
          jumpMasterTimeline(idx);
        });
      }

      if (masterStage && !masterStage.dataset.boundMaster) {
        masterStage.dataset.boundMaster = "1";
        masterStage.addEventListener("pointerdown", (event) => {
          clearFlingTail();
          if (intelMasterTimelineState.animating) return;
          if ((intelMasterTimelineState.items || []).length < 2) return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const interactive = event.target.closest("a,button,input,textarea,label,[data-intel-open-detail]");
          if (interactive) return;
          intelMasterTimelineState.dragging = true;
          intelMasterTimelineState.pointerId = event.pointerId;
          intelMasterTimelineState.dragStartX = Number(event.clientX || 0);
          intelMasterTimelineState.dragCurrentX = 0;
          intelMasterTimelineState.dragStartAt = Date.now();
          intelMasterTimelineState.dragSamples = [{ x: intelMasterTimelineState.dragStartX, t: intelMasterTimelineState.dragStartAt }];
          masterStage.classList.add("is-dragging");
          masterStage.style.setProperty("--intel-master-drag", "0px");
          if (typeof masterStage.setPointerCapture === "function") {
            try { masterStage.setPointerCapture(event.pointerId); } catch (_) {}
          }
        });
        masterStage.addEventListener("pointermove", (event) => {
          if (!intelMasterTimelineState.dragging) return;
          if (intelMasterTimelineState.pointerId !== null && event.pointerId !== intelMasterTimelineState.pointerId) return;
          const diff = Number(event.clientX || 0) - intelMasterTimelineState.dragStartX;
          intelMasterTimelineState.dragCurrentX = diff;
          const nowTs = Date.now();
          intelMasterTimelineState.dragSamples.push({ x: Number(event.clientX || 0), t: nowTs });
          intelMasterTimelineState.dragSamples = intelMasterTimelineState.dragSamples
            .filter((sample) => nowTs - Number(sample.t || 0) <= 180)
            .slice(-8);
          masterStage.style.setProperty("--intel-master-drag", `${diff}px`);
        });
        const finishDrag = (event) => {
          if (!intelMasterTimelineState.dragging) return;
          if (event && intelMasterTimelineState.pointerId !== null && event.pointerId !== intelMasterTimelineState.pointerId) return;
          const diff = intelMasterTimelineState.dragCurrentX;
          const duration = Date.now() - Number(intelMasterTimelineState.dragStartAt || 0);
          const threshold = Math.max(24, Math.round(masterStage.clientWidth * 0.045));
          const quickSwipe = duration <= 280 && Math.abs(diff) >= 14;
          let velocity = 0;
          const samples = Array.isArray(intelMasterTimelineState.dragSamples) ? intelMasterTimelineState.dragSamples : [];
          if (samples.length >= 2) {
            const first = samples[0];
            const last = samples[samples.length - 1];
            const dt = Math.max(1, Number(last.t || 0) - Number(first.t || 0));
            velocity = (Number(last.x || 0) - Number(first.x || 0)) / dt;
          }
          const flingSwipe = Math.abs(velocity) >= 0.36;
          const strongFling = Math.abs(velocity) >= 1.08;
          intelMasterTimelineState.dragging = false;
          intelMasterTimelineState.pointerId = null;
          intelMasterTimelineState.dragCurrentX = 0;
          intelMasterTimelineState.dragStartAt = 0;
          intelMasterTimelineState.dragSamples = [];
          masterStage.classList.remove("is-dragging");
          masterStage.style.removeProperty("--intel-master-drag");
          if (event && typeof masterStage.releasePointerCapture === "function") {
            try { masterStage.releasePointerCapture(event.pointerId); } catch (_) {}
          }
          if (Math.abs(diff) < threshold && !quickSwipe && !flingSwipe) return;
          const dir = Math.abs(diff) >= threshold || quickSwipe
            ? (diff < 0 ? 1 : -1)
            : (velocity < 0 ? 1 : -1);
          moveMasterTimeline(dir);
          if (strongFling) {
            clearFlingTail();
            intelMasterTimelineState.flingTailTimer = window.setTimeout(() => {
              intelMasterTimelineState.flingTailTimer = null;
              moveMasterTimeline(dir);
            }, 420);
          }
        };
        masterStage.addEventListener("pointerup", finishDrag);
        masterStage.addEventListener("pointercancel", finishDrag);
        masterStage.addEventListener("wheel", (event) => {
          clearFlingTail();
          if (intelMasterTimelineState.animating) return;
          if ((intelMasterTimelineState.items || []).length < 2) return;
          const nowTs = Date.now();
          if (nowTs < Number(intelMasterTimelineState.wheelLockedUntil || 0)) return;
          const dx = Number(event.deltaX || 0);
          const dy = Number(event.deltaY || 0);
          if (Math.abs(dx) < 4 || Math.abs(dx) < Math.abs(dy) * 0.62) return;
          event.preventDefault();
          intelMasterTimelineState.wheelAccum += dx;
          if (Math.abs(intelMasterTimelineState.wheelAccum) < 20) return;
          const dir = intelMasterTimelineState.wheelAccum > 0 ? 1 : -1;
          const fastWheel = Math.abs(intelMasterTimelineState.wheelAccum) >= 92;
          intelMasterTimelineState.wheelAccum = 0;
          intelMasterTimelineState.wheelLockedUntil = nowTs + 240;
          moveMasterTimeline(dir);
          if (fastWheel) {
            clearFlingTail();
            intelMasterTimelineState.flingTailTimer = window.setTimeout(() => {
              intelMasterTimelineState.flingTailTimer = null;
              moveMasterTimeline(dir);
            }, 410);
          }
        }, { passive: false });
        masterStage.addEventListener("click", async (event) => {
          const detailTrigger = event.target.closest("[data-intel-open-detail]");
          if (detailTrigger) {
            const tid = String(detailTrigger.dataset.intelOpenDetail || "").trim();
            if (tid) openIntelDetailModal(tid);
            return;
          }
          const btn = event.target.closest("button[data-intel-action][data-intel-id]");
          if (btn) {
            const action = String(btn.dataset.intelAction || "").trim();
            const id = String(btn.dataset.intelId || "").trim();
            const hintLabel = String(btn.dataset.intelLabel || "").trim();
            if (!id || !action) return;
            const extra = action === "timeline-save" ? readTimelineEditorPayload(btn) : {};
            btn.disabled = true;
            try {
              await handleIntelAction(action, id, hintLabel, extra);
            } catch (error) {
              setIntelMessage(`設定失敗：${error.message}`, "error");
            } finally {
              btn.disabled = false;
            }
            return;
          }
          const interactive = event.target.closest("a,button,input,textarea,label");
          const jumpNode = event.target.closest(".intel-master-slide.is-preview[data-master-jump]");
          if (jumpNode && !interactive) {
            const targetIndex = Number(jumpNode.dataset.masterJump || "-1");
            jumpMasterTimeline(targetIndex);
            return;
          }
        });
      }

      const savedJobId = loadAnalyzeJobId();
      if (savedJobId) {
        setIntelMessage(`偵測到背景分析工作 ${savedJobId}，正在接續追蹤中（可刷新）。`, "");
        startAnalyzePolling(savedJobId);
      }
    }

    const categoryLabels = {
      events: "活動",
      official: "官方近期更新",
      sbt: "SBT",
      pokemon: "寶可夢相關資訊",
      collectibles: "收藏趨勢",
      alpha: "未來規劃",
      guides: "攻略",
      community: "社群精選",
      other: "無",
    };

    function normalizeLangTag(raw) {
      const tag = String(raw || "").trim().toLowerCase();
      if (tag === "zh-hans" || tag === "zh-cn" || tag === "zh-sg") return "zh-Hans";
      if (tag === "en" || tag.startsWith("en-")) return "en";
      if (tag === "ko" || tag.startsWith("ko-")) return "ko";
      return "zh-Hant";
    }

    function getUiLangTag() {
      const select = document.getElementById("lang-select");
      if (select && select.value) return normalizeLangTag(select.value);
      const htmlLang = document.documentElement?.lang || "";
      if (htmlLang) return normalizeLangTag(htmlLang);
      return "zh-Hant";
    }

    function getStaticI18nByKey(key, fallback = "") {
      const rows = window.INTEL_UI_STATIC_TRANSLATIONS && window.INTEL_UI_STATIC_TRANSLATIONS[key];
      if (!rows || typeof rows !== "object") return String(fallback || "");
      const lang = getUiLangTag();
      return String(rows[lang] || rows["zh-Hant"] || fallback || "");
    }

    function renderCategoryHint(category) {
      const labelKeyMap = {
        events: "category.events",
        official: "category.official",
        sbt: "category.sbt",
        pokemon: "category.pokemon",
        collectibles: "category.collectibles",
        alpha: "category.alpha",
        guides: "category.guides",
        community: "category.community",
        other: "category.other",
      };
      const prefix = getStaticI18nByKey("category.hintPrefix", "目前顯示：");
      const suffix = getStaticI18nByKey("category.hintSuffix", "。");
      const labelKey = labelKeyMap[category] || "";
      const label = labelKey
        ? getStaticI18nByKey(labelKey, categoryLabels[category] || category)
        : (categoryLabels[category] || category);
      return `${prefix}${label}${suffix}`;
    }

    const categoryTargets = {
      events: "events",
      official: "intel",
      sbt: "sbt",
      pokemon: "pipeline",
      collectibles: "collectibles",
      alpha: "timeline",
      guides: "ops",
      community: "world",
      other: "community",
    };

    const legacySectionToCategory = {
      events: "events",
      versions: "events",
      intel: "official",
      sbt: "sbt",
      pipeline: "pokemon",
      collectibles: "collectibles",
      timeline: "alpha",
      ops: "guides",
      tools: "guides",
      world: "community",
      community: "other",
    };

    const categoryTabs = Array.from(document.querySelectorAll("[data-category-tab]"));
    const categorySections = Array.from(document.querySelectorAll("[data-category-section]"));
    const categoryHint = document.getElementById("category-switcher-hint");
    const navCategoryLinks = Array.from(document.querySelectorAll("a[data-nav-category]"));
    const adminOnlyCategories = new Set(["other"]);
    let activeCategory = "events";

    function isAdminOnlyCategory(category) {
      return adminOnlyCategories.has(String(category || "").trim().toLowerCase());
    }

    function canShowAdminOnlyCategories() {
      return document.body.classList.contains("intel-admin-mode");
    }

    function syncProtectedCategoryVisibility() {
      const canShow = canShowAdminOnlyCategories();
      categoryTabs.forEach((tab) => {
        if (!isAdminOnlyCategory(tab.dataset.categoryTab)) return;
        tab.hidden = !canShow;
        tab.setAttribute("aria-hidden", canShow ? "false" : "true");
      });
      categorySections.forEach((section) => {
        const keys = String(section.dataset.categorySection || "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (!keys.some(isAdminOnlyCategory)) return;
        section.hidden = !canShow;
        section.setAttribute("aria-hidden", canShow ? "false" : "true");
      });
      if (!canShow && isAdminOnlyCategory(activeCategory)) {
        setActiveCategory("events", { updateHash: true, smooth: false });
      }
    }

    window.syncProtectedIntelCategoryVisibility = syncProtectedCategoryVisibility;

    function resolveCategoryFromHash(hashValue) {
      const raw = String(hashValue || "").replace(/^#/, "").trim();
      if (!raw) return null;
      if (/^cat-/i.test(raw)) {
        const fromCatRaw = raw.replace(/^cat-/i, "").toLowerCase();
        const fromCat = fromCatRaw === "tools" ? "guides" : (fromCatRaw === "none" ? "other" : fromCatRaw);
        return categoryTargets[fromCat] ? fromCat : null;
      }
      return legacySectionToCategory[raw] || null;
    }

    function setActiveCategory(category, options = {}) {
      const opts = {
        updateHash: false,
        smooth: false,
        ...options,
      };
      const nextCategory = categoryTargets[category] ? category : "events";
      activeCategory = nextCategory;
      window.__intelActiveCategory = nextCategory;
      categoryTabs.forEach((tab) => {
        const isActive = tab.dataset.categoryTab === nextCategory;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      categorySections.forEach((section) => {
        const keys = String(section.dataset.categorySection || "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        const visible = keys.includes(nextCategory);
        section.classList.toggle("category-hidden", !visible);
      });
      navCategoryLinks.forEach((link) => {
        link.classList.toggle("is-active", link.dataset.navCategory === nextCategory);
      });
      if (categoryHint) {
        categoryHint.removeAttribute("data-i18n-key");
        categoryHint.textContent = renderCategoryHint(nextCategory);
      }
      if (opts.updateHash) {
        history.replaceState(null, "", `#cat-${nextCategory}`);
      }
      if (opts.smooth) {
        const targetId = categoryTargets[nextCategory];
        const targetEl = targetId ? document.getElementById(targetId) : null;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      window.requestAnimationFrame(() => {
        if (typeof updateScrollUi === "function") {
          updateScrollUi();
        }
      });
      if (typeof renderIntelCategoryFromCurrentFeed === "function") {
        renderIntelCategoryFromCurrentFeed(nextCategory);
      }
      markActiveCategoryFullyRendered(nextCategory);
      if (typeof scheduleIntelDeferredCategoryRender === "function") {
        scheduleIntelDeferredCategoryRender(5200);
      }
      if (typeof maybeRefreshPokemonNewsForCategory === "function") {
        maybeRefreshPokemonNewsForCategory(nextCategory);
      }
      const updateHintAfterLanguage = () => {
        if (typeof scheduleUiLanguageApply === "function") {
          scheduleUiLanguageApply(120);
          window.setTimeout(() => {
            if (categoryHint && activeCategory === nextCategory) {
              categoryHint.textContent = renderCategoryHint(nextCategory);
            }
          }, 180);
          return;
        }
        applyUiLanguage()
          .then(() => {
            if (categoryHint && activeCategory === nextCategory) {
              categoryHint.textContent = renderCategoryHint(nextCategory);
            }
          })
          .catch(() => {});
      };
      updateHintAfterLanguage();
    }

    function sectionMatchesCategory(section, category) {
      const keys = String(section?.dataset?.categorySection || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      return keys.includes(category);
    }

    function markActiveCategoryFullyRendered(category = activeCategory) {
      const nextCategory = categoryTargets[category] ? category : activeCategory;
      categorySections.forEach((section) => {
        if (!sectionMatchesCategory(section, nextCategory)) return;
        [section, ...Array.from(section.querySelectorAll(".observe"))].forEach((el) => {
          if (!el || !el.classList?.contains("observe")) return;
          el.style.setProperty("--delay", "0ms");
          el.classList.add("inview");
        });
      });
    }

    window.markActiveCategoryFullyRendered = markActiveCategoryFullyRendered;

    function setupCategorySwitcher() {
      categoryTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const category = String(tab.dataset.categoryTab || "").trim();
          if (!category) return;
          setActiveCategory(category, { updateHash: true, smooth: true });
        });
      });
      navCategoryLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
          const category = String(link.dataset.navCategory || "").trim();
          if (!category) return;
          event.preventDefault();
          setActiveCategory(category, { updateHash: true, smooth: true });
        });
      });
      window.addEventListener("hashchange", () => {
        const fromHash = resolveCategoryFromHash(window.location.hash);
        if (fromHash && fromHash !== activeCategory) {
          setActiveCategory(fromHash, { updateHash: true, smooth: false });
          syncProtectedCategoryVisibility();
        }
      });
      const initialFromHash = resolveCategoryFromHash(window.location.hash);
      if (initialFromHash) {
        setActiveCategory(initialFromHash, { updateHash: true, smooth: false });
      } else {
        setActiveCategory("events", { updateHash: false, smooth: false });
      }
    }

    function setupDirectGameLink() {
      const gameLinks = Array.from(document.querySelectorAll('a[href="game.html"], a[href="./game.html"]'));
      gameLinks.forEach((gameLink) => {
        if (!gameLink || gameLink.dataset.boundDirectNav) return;
        gameLink.dataset.boundDirectNav = "1";
        gameLink.addEventListener("click", (event) => {
          event.preventDefault();
          const lang = encodeURIComponent(normalizeUiLang(currentUiLang || document.documentElement.lang || "zh-Hant"));
          window.location.assign(`./game.html?lang=${lang}`);
        });
      });
    }

    renderSbtGroups();
    setupLanguageSwitcher();
    setupCategorySwitcher();
    if (typeof setupIntelLoadRepairButton === "function") {
      setupIntelLoadRepairButton();
    }
    applyUiLanguage().catch(() => {});
    renderIntelOnLoad();
    setupIntelActions();
    setupDirectGameLink();

    const topNav = document.querySelector(".nav");
    let lastScrollY = window.scrollY;
    let scrollTicking = false;

    function updateScrollUi() {
      if (topNav) {
        topNav.classList.remove("nav-hidden");
        lastScrollY = window.scrollY;
      }
    }

    function onScrollUi() {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        updateScrollUi();
        if (typeof scheduleIntelFeedPrefetchOnActivity === "function") {
          scheduleIntelFeedPrefetchOnActivity();
        }
        scrollTicking = false;
      });
    }

    window.addEventListener("scroll", onScrollUi, { passive: true });
    window.addEventListener("resize", onScrollUi);
    updateScrollUi();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("inview");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
      }
    );

    document.querySelectorAll(".observe").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) {
        el.style.setProperty("--delay", "0ms");
        el.classList.add("inview");
      } else {
        observer.observe(el);
      }
    });
