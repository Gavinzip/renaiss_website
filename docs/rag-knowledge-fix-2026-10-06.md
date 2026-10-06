# website RAG 修正與驗證 — 2026-10-06

**程式修正已獲 Gavin 同意 push，首次正式部署與 Fair 真實問答已確認。新手 Wiki 不新增 Fair 章節；末尾追加正式驗證與活動篩選補修正。尚未由 Gavin 驗收。**

Merch 的 `server/hub/assistant.mjs` 呼叫 `https://renaiss.zeabur.app/api/intel/agent`，使用 `top_k: 4`、`lang: zh-Hant` 與 history。本次未修改 Merch、前端樣式、正式服務程式、正式資料或任何金鑰設定。

## 根因與修改

1. 社群 `write_knowledge_memory()` 沒有收錄已發布 Wiki；Wiki 存在但從未進入 RAG。新建 `scripts/beginner_wiki.py`，網站 API 與檢索共用已發布 Wiki 讀取器及鎖，沿用既有 Directus／local-json 資料源選擇。
2. `official_knowledge.py` 以 Wiki 章節、FAQ、SBT 任務、工具、指令及實際教學說明分塊，完整內文進入 embedding 與上下文。四語言、來源 URL、section、provider、hash 均保留。引用連結沿用現行 Wiki reader 的舊章節分類相容規則，避免全部指向 start；未變更 CMS。
3. `official_sources.json` 明列 Fair 產品頁／白皮書、Index 用途／API 文件。內容來自公開正式文件，未硬編碼問題答案。白皮書保留 working draft 狀態。
4. 常駐索引、向量快取與來源快照獨立存於資料根 `official_knowledge/`，不受社群保留或 pruning 影響。Wiki hash、產品內文、模型或 schema 改變後建立新版本，完成後原子寫入；舊版本保留。
5. Wiki 沿用 Directus 60 秒 cache；產品 HTML cache 預設 3600 秒，可設定 `INTEL_OFFICIAL_DOCUMENT_CACHE_SECONDS`。來源到期讀取／embedding 失敗會報錯；未新增用社群回答掩蓋失敗的 fallback。既有資料源選擇與章節相容規則明列於上文。
6. 概念／用途題提升官方常駐內容；先過原始語意門檻再使用排序加分，避免無關貼文靠官方加分過關。活動意圖、時程篩選及來源多樣性均在 top_k 之前。
7. `knowledge_events.py` 以台北時間分辨正在舉行、未來、已結束、時程未確認；排除人事與產品展示／更新。報名公告日期與活動日期分開，支援完整年份及歷史指定日期。未知 AMA 不被宣稱今天可以參加，舊報名公告不證明今天仍開放。
8. 移除與現行 Directus 不同源的舊 SBT 特殊路由、固定答案及未使用 frontend JS 解析器；所有題目走同一檢索流程。回應附常駐版本、Wiki hash、來源類型／版本、候選／有效來源數及 query intent。

## 驗證環境與限制

- 本機 `.env` 與成功讀取的 1Password 既有金鑰均出現 `embedding_auth_invalid`。本機 Handler 的 POST 回應 502；該錯誤包含上游 401／403，後續未獨立確認精確狀態，不能把授權錯誤當成 RAG 測試結果。vault、`.env` 均未修改；金鑰未寫入報告或測試檔。
- 後測使用 `renaiss-web-164 / renaiss-website-git`（service `6aa132206c3d9581b715593c`，environment `6aa1308eda9bc245fb9d66d0`）。先確認其記憶版本與現行 API 一致，embedding 上游回應 200，再把修改的公開程式放入獨立 `/tmp` 目錄，使用既有有效 runtime 設定。
- 每次測試啟動獨立 HTTP Handler，使用 loopback 隨機 port；社群記憶與向量只從正式資料讀取並複製到測試目錄。排程、還原、備份均關閉，資料根隔離。正式 Python 程式、資料、部署和服務設定均未修改。測試結束後關閉獨立 HTTP Server。
- 一開始誤用同名舊 `renaiss / renaiss-website`，其記憶停在 9 月。該次 SBT 試跑不列入本次後測結論；已在現行服務重新驗證。
- Before 是較早的正式 API 快照（156 筆社群，generated `2026-10-06T07:10:14.716959+00:00`）；After 使用後續現行版本（154 筆，generated `2026-10-06T09:46:19.821650+00:00`）。未宣稱兩份社群語料完全相同；後測來源與常駐索引版本完整列出。
- 本節記錄 push 前的隔離驗證。Gavin 隨後同意 push；正式 `/api/intel/agent` 已套用首版修正，追加的 live 驗證記錄位於本報告末尾。

## 檢查結果

9 項結構回歸通過：完整 Wiki／四語言與指令、定義題取權威內容、先篩選再 top_k、缺活動不掛無關引用、跨日／今天／未來／歷史／未知時程、完整年度、報名不是 live event、來源失敗不降級、版本同步／快取隔離。結構回歸用明確 test-only embedding／模型替身；下面後測均為真實提供商，兩者區分。

真實後測共 16 次 HTTP 請求，涵蓋 12 種提問，embedding=`text-embedding-3-small`、答案模型=`MiniMax-M3`，`top_k=4`。查詢記憶為 154 個社群條目與 265 個常駐條目，共 419；相同文字共用向量，合併向量 410。

| 提問 | 實際結果 |
|---|---|
| SBT 定義 | 引用 Wiki 的參與／貢獻、聲望與積分說明；未來權益保持「可能」。 |
| Fair 介紹 | 引用官方產品頁及白皮書；說明 Construction／Seal／Draw，保留草稿狀態。 |
| 最近活動 | 只引用日期未知的 AMA 公告；不把過期活動、黑客松展示、人事當成可參加活動。 |
| 今天活動 | 現有來源不能確認今天可參加；不把舊報名公告當成仍開放。 |
| 2026-10-03 首爾 | 找到同一聚會的兩份公告，合併為一場並標示已結束。 |
| SBT 能否賣錢 | 引用 FAQ，不可轉讓、不可交易。 |
| FMV／估價 | 引用 Wiki 的 FMV、卡池／回購窗口及 TCG Pro 內容。 |
| 贖回實體卡 | 引用 Redeem、NFT／實體卡所有權與錯過回購窗口說明；細部寄送資料不足有揭露。 |
| TCG Pro 上傳照片 | 引用實際指令；Discord card-search 上傳卡圖後自動分析。 |
| Index 定位 | 引用價格服務條款與 API；不是單純合作網絡。 |
| 多輪追問「那可以轉給朋友嗎？」 | history=2，沿用 SBT 脈絡並引用不可轉讓 FAQ。 |
| English SBT／sale | 回答英文，引用英文 Wiki 的不可交易說明。 |

第一個冷啟動真實請求 `index_cache_hit=false`，19.45 秒；後續新程序仍載入相同索引，`index_cache_hit=true`。索引命中表示重用向量／來源索引，並非答案或瀏覽器快取。所有測試 HTTP 回應 `Cache-Control: no-store`；來源內容更新回歸則驗證新 hash 產生新索引。

Wiki provider=`directus`，四語言來源 hash：

`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`

真實常駐索引版本：

`37505985e93db66bd6a9974c7c4267c61dc1d6d90fa861abd5fae7c62025c7f3`

建立時間 `2026-10-06T10:06:53.620815+00:00`。產品內容 hash 在各引用下列出。`git diff --check`、6 個 Python 模組語法檢查通過。未修改前端，尚未進入部署，所以未宣稱完成部署資產／壓縮／CDN 驗收。

## Before：正式 API 的原始回答

### Renaiss 的 SBT 是什麼？

根據現有記憶，**Renaiss 的 SBT 是一種可與 Renaiss 卡牌一同展示的數位收藏品（鏈上憑證）**，目前記憶中尚未對其技術規格、發行機制或完整用途提供完整定義。

**重點細節：**
- **定位**：SBT 與 Renaiss 卡牌同屬 Renaiss 生態的收藏物件，屬於不可轉讓的鏈上憑證（常見於此類生態）[1][2]。
- **展示方式**：Renaiss Tech 黑客松 S1 第七號專案 CardScene 將 Renaiss 卡牌與 SBT 整合為可互動的 3D 收藏空間，使用者可在 3D 卡櫃中瀏覽 SBT 收藏 [1]。
- **類似應用參考**：同生態的 Vinci World 曾以 SBT 作為迎新紀念禮，標記用戶參與新社群頻道啟用的鏈上憑證 [2]。

**下一步建議：**
- 建議查詢 Renaiss 官方（@tastedotmd 或 @renaissCLTB）對 SBT 的專門說明貼文，以取得完整定義與應用場景。
- 可追蹤 CardScene 專案後續開發進度，了解 SBT 在實際產品中的呈現方式 [1]。

※ 目前記憶不足以完整說明 Renaiss SBT 的發行規則、技術標準與所有用途，若需更精確資訊，建議參考 Renaiss 官方文件或白皮書。

引用：

- [1] [Renaiss黑客松S1第七號專案聚焦CardScene](https://x.com/tastedotmd/status/2096885448065126505) — kind=social; semantic=0.4879; rank=0.5879; reasons=official_source
- [2] [Vinci World 進駐 Threads 完成步驟可領迎新 SBT](https://x.com/vinciwld/status/2103114734144995762) — kind=social; semantic=0.3674; rank=0.5874; reasons=official_source,sbt_match
- [3] [Renaiss 將於 BNB Seoul 設攤，現場體驗 Vinci Catch](https://x.com/renaissCLTB/status/2105873222847934622) — kind=social; semantic=0.4676; rank=0.5676; reasons=official_source
- [4] [Renaiss 黑客松 S1 焦點專案 12：Renaiss Card DNA](https://x.com/tastedotmd/status/2101959623737745830) — kind=social; semantic=0.4674; rank=0.5674; reasons=official_source

HTTP headers: `{"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"}`

### 介紹一下 Renaiss Fair。

目前的 Renaiss 知識記憶中並未包含關於「Renaiss Fair」的相關資訊，無法提供介紹。

引用：

- [1] [Renaiss 預告 10 月 2 日新成員揭曉](https://x.com/renaissCLTB/status/2105237476545814966) — kind=social; semantic=0.5156; rank=0.6156; reasons=official_source
- [2] [首爾開包聚會｜Renaiss 與你相約 KBW 後](https://x.com/renaissxyz/status/2103076982342971890) — kind=social; semantic=0.511; rank=0.611; reasons=official_source
- [3] [Renaiss Protocol 公開新版 logo 與視覺識別](https://x.com/renaissCLTB/status/2098713309293994172) — kind=social; semantic=0.5099; rank=0.6099; reasons=official_source
- [4] [Renaiss Night：寶可夢 30 週年慶祝](https://x.com/renaissxyz/status/2100224492580855848) — kind=social; semantic=0.4941; rank=0.5941; reasons=official_source

HTTP headers: `{"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"}`

### 最近有什麼活動

目前記憶中沒有明確列出即將在近日舉行、附帶具體時間的線下或直播活動。以下是近期可掌握的活動線索：

**1. 寶可夢 30 週年 AMA 得獎公布（時間待確認）** [1][2]
- 寶可夢 30 週年紀念活動已於 2026-09-30 正式落幕，中獎名單預計於 AMA 公布 [2]。
- 該 AMA 為「寶可夢 30 週年 AMA 特別活動」，將以線上 AMA 形式進行，從有效報名中抽出 10 位幸運收藏家 [1]。
- 目前記憶未提供 AMA 的具體日期與時間，建議關注 @renaissCLTB 與 @renaissxyz 的後續公告以取得確切時程。

**2. Renaiss Tech 黑客松 S1：Vinci Vault Battle（專案焦點）** [4]
- 黑客松 S1 第 9 場焦點專案，由 @arr_kr 打造的瀏覽器策略遊戲，將開包與卡牌收藏化為自動組牌。
- 屬於黑客松系列專案展示，無需報名，地點為線上瀏覽器，但無具體活動日期 [4]。

**建議下一步**
- 若想參加寶可夢 30 週年 AMA，建議持續追蹤 @renaissCLTB 與 @renaissxyz 取得正式時間與參與方式。
- 黑客松系列專案可直接在線上瀏覽器體驗 Vinci Vault Battle。

引用：

- [1] [寶可夢30週年AMA特別活動](https://x.com/renaissCLTB/status/2103786659347403131) — kind=social; semantic=0.3221; rank=0.5121; reasons=event_card,event_text
- [2] [Pokémon 30週年活動圓滿落幕](https://x.com/renaissxyz/status/2102717730361073813) — kind=social; semantic=0.3136; rank=0.4436; reasons=event_text,event_official_priority
- [3] [更清楚看見你的 XYZ 推薦旅程](https://x.com/renaissxyz/status/2099442155270164627) — kind=social; semantic=0.3485; rank=0.4185; reasons=event_official_priority
- [4] [黑客松 S1 焦點 09：Vinci Vault Battle](https://x.com/tastedotmd/status/2097941732629635151) — kind=social; semantic=0.2798; rank=0.4098; reasons=event_card

HTTP headers: `{"Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8"}`

## After：真實後測答案與引用

以下保留原始模型回答。活動題的最後版本已收緊語氣與舊報名公告處理；其他範例也用相同檢索實作，其中部分於這次 prompt 收緊前測得，未隱瞞其當時輸出。未把模型文字當成官方額外承諾。

### 2026 年 10 月 3 日首爾有什麼 Renaiss 活動？

2026 年 10 月 3 日首爾的 Renaiss 活動是「首爾開包聚會」，於 KBW 2026 結束後在首爾舉行，由 Renaiss 團隊核心成員親自出席，內容以開包、卡牌交流、社群對話為主，並備有啤酒同樂，歡迎收藏家與新朋友參加[1][2]。

不過，根據記憶中的事件狀態，這場聚會已於 2026 年 10 月 3 日結束，無法再加入。

引用：

- [1] [首爾開包聚會｜Renaiss 與你相約 KBW 後](https://x.com/renaissxyz/status/2103076982342971890) — kind=social; semantic=0.6077; rank=1.3877; reasons=event_card,official_source,queried_event_date,event_official_priority; event_status=ended
- [2] [KBW 2026結束後Renaiss首爾社群聚會，10月3日登場](https://x.com/RenaissKrCM/status/2103067027321852227) — kind=social; semantic=0.5209; rank=1.1309; reasons=event_card,queried_event_date; event_status=ended

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=10.55s; social=154; candidates=250; eligible=2; history=0; index_cache_hit=true; top_k=4.

### 介紹一下 Renaiss Fair。

Renaiss Fair 是 Renaiss 的可驗證抽卡（Gacha）協議，用來在鏈上公平地抽出 Renaiss Collectibles（代表實體 TCG 卡牌的 NFT 資產）[4]。

它要解決的核心問題是：一般 Gacha 開包發生在營運方的伺服器內，玩家只能信任營運方沒有操控結果，數位紀錄本身無法防止事後竄改 [1]。

Renaiss Fair 透過三個支柱來建立可被獨立驗證的公平性 [1][3]：

- **Pillar I · Construction（構造）**：每個卡包由公開的 Fair Set Algorithm 產生，需符合公布的預期價值（EV）範圍與各品階的最小／最大數量限制；最高品階收藏品在每包中為保證出現，不可「可能沒有」[1][3]。
- **Pillar II · Seal（封存）**：每包從 Renaiss Collectibles 的大庫存中抽出，並在上架前將其 Merkle root 寫上鏈；一旦上架後，新增、刪除或替換任何一張卡都會產生不同的 root，因此陣容無法在開賣後被更改 [1][2][3]。
- **Pillar III · Draw（抽籤）**：每次購買從鏈上「付款後才存在」的資料（blockHash 等）衍生 ECVRF 輸出，再對該包剩餘卡數取模決定抽出哪一張；ECVRF 的證明（依 RFC 9381）任何人皆可用公布的公鑰驗證，等同從頭到尾釘死具體那張卡 [1][2][3]。

相較之下，一般 Web2 平台從私有資料庫產生結果，玩家無從檢查；多數 Web3 平台則只有代幣在鏈上，卡包組成邏輯並未上鏈 [2]。

補充說明：以上技術細節來自標註為 working draft（v1.0.0，2026-08-28）的 Gacha Whitepaper [1][3]。

引用：

- [1] [Renaiss Fair — Gacha Whitepaper](https://fair.renaiss.xyz/whitepaper) — kind=product_document; semantic=0.517; rank=0.837; reasons=official_source,evergreen_official,title_match
  - source_version=`b0055e914453b1696f2942747a8ccb8ee7a27570f8db00b31a9087774fc79a7b`; section=page; language=en; status=working draft
- [2] [Renaiss Fair](https://fair.renaiss.xyz/) — kind=product_document; semantic=0.4831; rank=0.8031; reasons=official_source,evergreen_official,title_match
  - source_version=`ccd64309fe16fa6c8709d525f73f1fad36c4e0159972ed35e035f7fd6adb4165`; section=page; language=en; status=product
- [3] [Renaiss Fair — Gacha Whitepaper](https://fair.renaiss.xyz/whitepaper) — kind=product_document; semantic=0.4789; rank=0.7989; reasons=official_source,evergreen_official,title_match
  - source_version=`b0055e914453b1696f2942747a8ccb8ee7a27570f8db00b31a9087774fc79a7b`; section=page; language=en; status=working draft
- [4] [Renaiss 新手教學 — Renaiss 是什麼](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=start) — kind=wiki; semantic=0.532; rank=0.772; reasons=official_source,evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-0; language=zh-Hant; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=14.86s; social=154; candidates=251; eligible=228; history=0; index_cache_hit=true; top_k=4.

### FMV 是什麼？卡牌價格怎麼估算？

**FMV 是什麼？**

FMV（Fair Market Value，公允市場價值）是 Renaiss 卡牌在鏈上記錄的市場價格指標，會反映真實世界二級市場的成交價格。因此當外部市場下跌或上漲時，鏈上 FMV 也可能同步調整 [1]。

FMV 也是官方回購托底的計算基準：
- 限時卡池：開包後 10 分鐘內可享 90% FMV 官方回購 [2]
- 無限卡機（RenaCrypto Pack / OMEGA）：開包後 3 天內享 85% FMV 回購托底 [4]

**卡牌價格怎麼估算？**

官方提供的 TCG Pro 分析流程可直接拉取外部市場的成交紀錄作為價格判讀依據，並支援同卡跨版本比較視圖，幫助提升估值判斷效率 [3]。

**下一步建議：**
- 估算單卡價格時，優先以 TCG Pro 拉取的外部成交參照為主 [3]
- 若需變現，注意各品類的回購時間窗口與 FMV 比例不同（限時卡池 10 分鐘／90%；無限卡機 3 天／85%）[2][4]
- 外部二級市場行情變動會連帶影響鏈上 FMV，估算時應同步觀察外部價格走勢 [1]

**註：** 目前記憶中關於 FMV 的完整定義文件與 TCG Pro 詳細操作步驟的原文較為有限，若需更深入的機制說明，建議參考 Renaiss Wiki 完整頁面 [1][3]。

引用：

- [1] [Renaiss 新手教學 — 為什麼 FMV 會突然下降？](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=faq) — kind=wiki; semantic=0.5369; rank=0.7569; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=faq-3; language=zh-Hant; status=published
- [2] [Renaiss 新手教學 — 限時卡池](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=packs) — kind=wiki; semantic=0.4525; rank=0.5925; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-2; language=zh-Hant; status=published
- [3] [Renaiss 新手教學 — TCG Pro 分析流程](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=tools) — kind=wiki; semantic=0.4114; rank=0.5514; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=command-showcase; language=zh-Hant; status=published
- [4] [Renaiss 新手教學 — 無限卡機](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=packs) — kind=wiki; semantic=0.3941; rank=0.5341; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-3; language=zh-Hant; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=12.27s; social=154; candidates=251; eligible=179; history=0; index_cache_hit=true; top_k=4.

### Renaiss Index 是什麼？它提供什麼？

Renaiss Index 是由 Renaiss 經營的**收藏卡牌公開參考價格網站**（網址：index.renaissos.com），提供資訊性的價格參考，而非交易場所或理財建議 [1]。

**它提供的主要內容：**

- **每日市場指數**：目前已發布 Pokémon、One Piece 與 Sports 的公開市場指數 [1]。
- **可搜尋的卡片目錄**：另收錄 Lorcana、Digimon、Riftbound、魔法風雲會（MTG）、Yu-Gi-Oh! 與鋼彈等其他遊戲，覆蓋範圍持續擴張，依卡片而異 [1]。
- **每張卡片的參考價格**：依卡別與評級（grade）公布平均數、中位數與成交量加權平均價格（皆以美元計），並附帶交易紀錄 [1]。
- **評級卡資料查詢**：可透過公開 API 查詢，例如 `/v1/graded/{cert}` 提供 `priceUsdCents`、`deltaPct`、`confidence`、`updatedAt`、`lastSaleAt` 等欄位 [4]。

**資料來源：**

價格與指數是根據公開交易市集（Site S、Site A、Mercari、Yahoo! Auctions、eBay JP、TCGplayer 等）、鏈上市集、合作的店家報價或交易、PSA 人口資料以及 Renaiss 自有交易紀錄等真實已記錄的銷售資料計算而成 [1]。

**使用限制：**

- 公布的價格為**過去銷售的資訊性估計值**，不構成報價、買賣要約或任何金融建議 [1]。
- 公開展示任何數字時，必須標註出處（「Renaiss Index」並附上來源頁面連結）[4]。
- 服務與條款可能隨時更新；使用即視為接受當下條款 [2]。

引用：

- [1] [Renaiss Index — Product scope and terms](https://index.renaissos.com/en/terms) — kind=product_document; semantic=0.6734; rank=0.9934; reasons=official_source,evergreen_official,title_match
  - source_version=`877b7c7d228dbdff67ff2b7555bfbde3f16727748a5323c14101388969f4b522`; section=page; language=en; status=published
- [2] [Renaiss Index — Product scope and terms](https://index.renaissos.com/en/terms) — kind=product_document; semantic=0.641; rank=0.961; reasons=official_source,evergreen_official,title_match
  - source_version=`877b7c7d228dbdff67ff2b7555bfbde3f16727748a5323c14101388969f4b522`; section=page; language=en; status=published
- [3] [Renaiss Index — Public API and reference prices](https://index.renaissos.com/en/api-docs) — kind=product_document; semantic=0.5707; rank=0.8907; reasons=official_source,evergreen_official,title_match
  - source_version=`52089c0a819ca002d067755e31c06c99e26a6fb9f9d00591b89817c2ae264ecc`; section=page; language=en; status=published
- [4] [Renaiss Index — Public API and reference prices](https://index.renaissos.com/en/api-docs) — kind=product_document; semantic=0.5187; rank=0.8387; reasons=official_source,evergreen_official,title_match
  - source_version=`52089c0a819ca002d067755e31c06c99e26a6fb9f9d00591b89817c2ae264ecc`; section=page; language=en; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=15s; social=154; candidates=251; eligible=207; history=0; index_cache_hit=true; top_k=4.

### 最近有什麼活動

根據目前取得的資料，沒有可以確認「目前可參加」的活動。

唯一相關的紀錄是寶可夢 30 週年 AMA 特別活動的報名公告。該公告於 2026-09-26 發布，宣布將以 AMA 形式回顧週年活動歷程，並從有效報名中抽出 10 位收藏家。然而，公告中未提供具體舉辦時間，且活動日期尚未經確認，因此無法判斷其是否已可參加或報名是否仍開放 [1]。

引用：

- [1] [寶可夢30週年AMA特別活動](https://x.com/renaissCLTB/status/2103786659347403131) — kind=social; semantic=0.3221; rank=0.5121; reasons=event_card,event_text; event_status=timing_unconfirmed

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=9.83s; social=154; candidates=184; eligible=1; history=0; index_cache_hit=true; top_k=4.

### 我開到卡牌後，要怎麼贖回實體卡？

你可以透過 **Redeem** 功能把實體卡提取出來，這是 Renaiss 在官方新手教學中明確列出的三種處理方式之一 [1]：

- **時間 / 期限**：Redeem 並非限時功能，與官方回購不同；即使超過 3 天或 10 分鐘保底時間，無法官方回購時，仍可選擇 Redeem 提取實體卡 [4]。
- **所有權依據**：你錢包中的 NFT 是金庫內實體卡的「唯一所有權憑證」，與實體卡為 1:1 錨定的數位雙生資產 [2]。
- **為什麼重要**：實體卡由第三方金庫託管，並經過權威評級或鑑定，因此 Redeem 後取得的是經驗證的真品 [3]。
- **下一步**：檢視卡牌詳情頁中是否有「Redeem / 贖回」按鈕以啟動申請流程。具體的申請步驟、運費與寄送細節，目前的 Renaiss 知識記憶並未提供；建議直接在平台卡牌頁面或官方新手教學確認 Redeem 流程。

來源：[1] Renaiss Wiki — 抽到卡之後可以怎麼處理？、[2] Renaiss Wiki — 抽到的是圖片 NFT 還是真實實體卡？、[4] Renaiss Wiki — 錯過保底時間還能官方回購嗎？、[3] Renaiss Wiki — 怎麼確保卡是真的？

引用：

- [1] [Renaiss 新手教學 — 抽到卡之後可以怎麼處理？](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=faq) — kind=wiki; semantic=0.694; rank=0.834; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=faq-2; language=zh-Hant; status=published
- [2] [Renaiss 新手教學 — 我在平台上抽到的卡，到底是圖片 NFT 還是真實實體卡？](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=faq) — kind=wiki; semantic=0.5117; rank=0.6517; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=faq-0; language=zh-Hant; status=published
- [3] [Renaiss 新手教學 — 怎麼確保卡是真的？金庫安全嗎？](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=faq) — kind=wiki; semantic=0.4976; rank=0.6376; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=faq-1; language=zh-Hant; status=published
- [4] [Renaiss 新手教學 — 錯過 3 天或 10 分鐘保底時間還能官方回購嗎？](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=faq) — kind=wiki; semantic=0.4932; rank=0.6332; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=faq-4; language=zh-Hant; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=13.24s; social=154; candidates=251; eligible=224; history=0; index_cache_hit=true; top_k=4.

### Renaiss 的 SBT 是什麼？

SBT（Soulbound Token）是 Renaiss 項目中你在鏈上的參與與貢獻證明[3]。

**核心定位**
- 它不是單純的徽章，而是會累積成你在 Renaiss 內的聲望與積分紀錄[1]。
- 每個 SBT 可能對應不同的積分權重，越早、越稀有、越有貢獻的紀錄通常越重要[1]。

**可累積的 SBT 類型（依官方 Wiki）**
- 直接任務類：綁定帳號、充值、開包、交易[1][3]。
- 社群貢獻類：參與 Discord、AMA、活動、X 互動、內容創作、邀請[1][3]。
- 開發工具類：為 Renaiss 建工具、App、插件或 AI 系統（Community Developer，需到官方 Discord 開 Tool Apply 票提交並被認可）[4]。
- 特殊榮譽類：例如 Contributor of the Week（被 Renaiss 團隊選為當週 top contributor）[2]。

**未來用途（來源中標示為可能或未來權益，非保證）**
- 兌換官方周邊[1]。
- 抽卡（gacha）機會[1]。
- 作為活動、白名單或獎勵資格的參考[1][3]。

簡單來說，SBT 是 Renaiss 用來記錄你對項目參與深度的鏈上成就系統，會影響你在項目內的聲望積分與後續可能取得的權益[1][3]。

引用：

- [1] [Renaiss 新手教學 — SBT 取得方式](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=sbt) — kind=wiki; semantic=0.5945; rank=0.9145; reasons=official_source,evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-5; language=zh-Hant; status=published
- [2] [Renaiss 新手教學 — SBT — Contributor of the Week](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=sbt) — kind=wiki; semantic=0.5911; rank=0.9111; reasons=official_source,evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=sbt-15; language=zh-Hant; status=published
- [3] [Renaiss 新手教學 — Marketplace 與 SBT](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=market) — kind=wiki; semantic=0.584; rank=0.904; reasons=official_source,evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-4; language=zh-Hant; status=published
- [4] [Renaiss 新手教學 — SBT — Community Developer](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=sbt) — kind=wiki; semantic=0.5806; rank=0.9006; reasons=official_source,evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=sbt-16; language=zh-Hant; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=13.83s; social=154; candidates=251; eligible=200; history=0; index_cache_hit=true; top_k=4.

### What is Renaiss SBT, and can I sell it?

Renaiss SBT (Soulbound Token) is a wallet-bound, on-chain achievement record that reflects your participation and contribution within the Renaiss ecosystem [2].

**No, you cannot sell an SBT for money.** SBTs are non-transferable and non-tradable — they are permanently bound to your wallet as proof of your activities and contributions [1].

If you're looking to buy, sell, or trade assets on Renaiss, those actions apply to **cards on the Marketplace**, not SBTs [2].

引用：

- [1] [Renaiss 新手教學 — Can I sell an SBT for money?](https://renaiss.zeabur.app/beginner.html?lang=en&topic=faq) — kind=wiki; semantic=0.6735; rank=1.0735; reasons=official_source,evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=faq-5; language=en; status=published
- [2] [Renaiss 新手教學 — Marketplace and SBT](https://renaiss.zeabur.app/beginner.html?lang=en&topic=market) — kind=wiki; semantic=0.5631; rank=0.9631; reasons=official_source,evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-4; language=en; status=published
- [3] [Renaiss 新手教學 — SBT — Community Developer](https://renaiss.zeabur.app/beginner.html?lang=en&topic=sbt) — kind=wiki; semantic=0.4923; rank=0.8923; reasons=official_source,evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=sbt-16; language=en; status=published
- [4] [Renaiss 新手教學 — SBT — Community Event Organizer](https://renaiss.zeabur.app/beginner.html?lang=en&topic=sbt) — kind=wiki; semantic=0.4842; rank=0.8842; reasons=official_source,evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=sbt-17; language=en; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=7.29s; social=154; candidates=251; eligible=196; history=0; index_cache_hit=true; top_k=4.

### 那可以轉給朋友嗎？

不行，Renaiss 的 SBT（Soulbound Token）是綁定你錢包的鏈上成就證明，**不可轉讓、不可交易** [2]。

它不是可以送人或轉讓的道具，而是綁定在你錢包地址上的參與度與貢獻紀錄，所以也無法直接轉給朋友 [2]。

**下一步建議**：與其想轉移 SBT，更實際的做法是引導朋友從基礎任務開始（綁定帳號、充值、開包、交易），並透過 Discord 與 X 互動累積他們自己的 SBT 與積分 [1][3]。

引用：

- [1] [Renaiss 新手教學 — SBT 取得方式](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=sbt) — kind=wiki; semantic=0.6144; rank=0.7544; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-5; language=zh-Hant; status=published
- [2] [Renaiss 新手教學 — SBT 可以賣掉換錢嗎？](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=faq) — kind=wiki; semantic=0.6132; rank=0.7532; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=faq-5; language=zh-Hant; status=published
- [3] [Renaiss 新手教學 — Marketplace 與 SBT](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=market) — kind=wiki; semantic=0.5885; rank=0.7285; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-4; language=zh-Hant; status=published
- [4] [Renaiss 新手教學 — SBT — The Vanguard](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=sbt) — kind=wiki; semantic=0.5884; rank=0.7284; reasons=evergreen_official
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=sbt-20; language=zh-Hant; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=5.8s; social=154; candidates=251; eligible=220; history=2; index_cache_hit=true; top_k=4.

### SBT 可以賣掉換錢嗎？

**不能，SBT 無法賣掉換錢。**

SBT（Soulbound Token）是綁定錢包的鏈上成就證明，**不可轉讓、不可交易**，性質比較接近你的參與度與貢獻紀錄，而非可流通的資產 [1]。

**它能做的事：**
- 反映你在 Renaiss 的參與與貢獻 [2]
- 累積成項目內的聲望與積分紀錄，不同 SBT 有不同權重 [3]
- **未來**可能可用來兌換官方周邊、抽卡機會，或取得活動、白名單、獎勵資格 [3]（屬於「可能的未來權益」，並非已確定可即時兌現）

**簡單區分：**
- **Marketplace 上的卡牌**：可在交易市場買入、賣出、競拍，會累積 Superliquid 積分 [2]
- **SBT**：綁定錢包，不能賣，也不能換錢 [1]

下一步建議：若想增加 SBT 紀錄，可從綁定帳號、充值、開包、交易等基礎任務開始，內容創作與社群互動也會計入貢獻 [3]。

引用：

- [1] [Renaiss 新手教學 — SBT 可以賣掉換錢嗎？](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=faq) — kind=wiki; semantic=0.7333; rank=0.9533; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=faq-5; language=zh-Hant; status=published
- [2] [Renaiss 新手教學 — Marketplace 與 SBT](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=market) — kind=wiki; semantic=0.5137; rank=0.7337; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-4; language=zh-Hant; status=published
- [3] [Renaiss 新手教學 — SBT 取得方式](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=sbt) — kind=wiki; semantic=0.4872; rank=0.7072; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=section-5; language=zh-Hant; status=published
- [4] [Renaiss 新手教學 — SBT — The Trader](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=sbt) — kind=wiki; semantic=0.446; rank=0.666; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=sbt-3; language=zh-Hant; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=9.01s; social=154; candidates=251; eligible=160; history=0; index_cache_hit=true; top_k=4.

### TCG Pro 可以上傳卡牌照片分析嗎？要怎麼操作？

可以。TCG Pro 支援直接上傳卡牌照片進行分析 [2]。

**操作方式：**
1. 進入 Discord 的 **card-search** 頻道
2. 直接上傳卡圖
3. 系統會自動觸發分析，完成價格分析並輸出海報 [2]

這屬於「卡牌自動分析」功能，無需手動下指令，上傳圖片後即由系統自動處理。

引用：

- [1] [Renaiss 新手教學 — TCG Pro 分析流程](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=tools) — kind=wiki; semantic=0.6739; rank=0.9739; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=command-showcase; language=zh-Hant; status=published
- [2] [Renaiss 新手教學 — TCG Pro — 卡牌自動分析](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=tools) — kind=wiki; semantic=0.644; rank=0.944; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=command-0; language=zh-Hant; status=published
- [3] [Renaiss 新手教學 — TCG Pro — 卡盒報告](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=tools) — kind=wiki; semantic=0.5869; rank=0.8869; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=command-1; language=zh-Hant; status=published
- [4] [Renaiss 新手教學 — TCG Pro — PACK-RANK](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=tools) — kind=wiki; semantic=0.5486; rank=0.8486; reasons=evergreen_official,title_match
  - source_version=`3f0dda35e1c923315142f5e10a4a4c12753817b3e18081626e7bb68fce9f5196`; section=command-7; language=zh-Hant; status=published

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=9.03s; social=154; candidates=251; eligible=225; history=0; index_cache_hit=true; top_k=4.

### 今天有什麼可以參加的 Renaiss 活動？

根據目前取得的資料，沒有可即時加入的 Renaiss 活動可供參加。

唯一相關的紀錄是「寶可夢30週年AMA特別活動」，該公告提及將以線上 AMA 形式舉行並舉辦抽獎，但未提供具體的活動時間，且該資訊的時程狀態為未確認 [1]。因此，依現有來源無法確認目前有任何正在進行或即將到來的 Renaiss 活動可以參加。

引用：

- [1] [寶可夢30週年AMA特別活動](https://x.com/renaissCLTB/status/2103786659347403131) — kind=social; semantic=0.3612; rank=0.6512; reasons=event_card,event_text,official_source; event_status=timing_unconfirmed

HTTP headers: `{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}`

Trace: mode=rag; elapsed=5.92s; social=154; candidates=228; eligible=1; history=0; index_cache_hit=true; top_k=4.

## 測試暫存清理清單

依 Gavin 在上一輪報告後的「我也同意」清理本輪測試檔。以下是執行前的完整清單；正式資料、使用者素材、既有 `design-qa.md`、交付的本報告與修正程式均保留。

**狀態：107 個列出的測試暫存已刪除；本機與兩個服務的測試根目錄均確認不存在，3 個新增 Python cache 均確認不存在。以下保留刪除紀錄，實際問答與來源證據已保存在本報告。**

### 本機測試目錄

- `/tmp/renaiss-rag-2026-10-06/api/community_hub_auth.sqlite3`
- `/tmp/renaiss-rag-2026-10-06/api/expo_profile.sqlite3`
- `/tmp/renaiss-rag-2026-10-06/api/official_knowledge/documents/renaiss-fair-ccd64309fe16fa6c8709d525f73f1fad36c4e0159972ed35e035f7fd6adb4165.json`
- `/tmp/renaiss-rag-2026-10-06/api/official_knowledge/documents/renaiss-fair-whitepaper-b0055e914453b1696f2942747a8ccb8ee7a27570f8db00b31a9087774fc79a7b.json`
- `/tmp/renaiss-rag-2026-10-06/api/official_knowledge/documents/renaiss-fair-whitepaper.json`
- `/tmp/renaiss-rag-2026-10-06/api/official_knowledge/documents/renaiss-fair.json`
- `/tmp/renaiss-rag-2026-10-06/api/official_knowledge/documents/renaiss-index-api-52089c0a819ca002d067755e31c06c99e26a6fb9f9d00591b89817c2ae264ecc.json`
- `/tmp/renaiss-rag-2026-10-06/api/official_knowledge/documents/renaiss-index-api.json`
- `/tmp/renaiss-rag-2026-10-06/api/official_knowledge/documents/renaiss-index-scope-877b7c7d228dbdff67ff2b7555bfbde3f16727748a5323c14101388969f4b522.json`
- `/tmp/renaiss-rag-2026-10-06/api/official_knowledge/documents/renaiss-index-scope.json`
- `/tmp/renaiss-rag-2026-10-06/before-335540af.json`
- `/tmp/renaiss-rag-2026-10-06/before-cff09718.json`
- `/tmp/renaiss-rag-2026-10-06/before-e4241cb9.json`
- `/tmp/renaiss-rag-2026-10-06/check_regressions.py`
- `/tmp/renaiss-rag-2026-10-06/event-eligibility.json`
- `/tmp/renaiss-rag-2026-10-06/local-api-blocker.json`
- `/tmp/renaiss-rag-2026-10-06/official_knowledge/documents/renaiss-fair-ccd64309fe16fa6c8709d525f73f1fad36c4e0159972ed35e035f7fd6adb4165.json`
- `/tmp/renaiss-rag-2026-10-06/official_knowledge/documents/renaiss-fair-whitepaper-f9f149ca05891530994c6386b4ee9830d8d0012e65b21dcb2b7672152b69663b.json`
- `/tmp/renaiss-rag-2026-10-06/official_knowledge/documents/renaiss-fair-whitepaper.json`
- `/tmp/renaiss-rag-2026-10-06/official_knowledge/documents/renaiss-fair.json`
- `/tmp/renaiss-rag-2026-10-06/official_knowledge/documents/renaiss-index-api-307abbfbdb1c5005035dce6ac9afb28267e67bc5163c85f49749d8cdfa31d90e.json`
- `/tmp/renaiss-rag-2026-10-06/official_knowledge/documents/renaiss-index-api.json`
- `/tmp/renaiss-rag-2026-10-06/official_knowledge/documents/renaiss-index-scope-79d19f15677ded0d2c5a25b53a4642dd4a5f4aa6afc5c5d94485fc0cd80d82e8.json`
- `/tmp/renaiss-rag-2026-10-06/official_knowledge/documents/renaiss-index-scope.json`
- `/tmp/renaiss-rag-2026-10-06/production-feed.json`
- `/tmp/renaiss-rag-2026-10-06/production-memory-items.json`
- `/tmp/renaiss-rag-2026-10-06/regressions/versions/official_knowledge/indexes/4f6a98033c6e84d2ed1eab3ee11bb9a18d7e735f253db775a3ecac5f6ccecf4e.json`
- `/tmp/renaiss-rag-2026-10-06/regressions/versions/official_knowledge/indexes/6f22d501cac8455e293cb0bb4db78b42e714bfed937c05cf3d6c16a1114850e1.json`
- `/tmp/renaiss-rag-2026-10-06/regressions/versions/official_knowledge/indexes/a7d563c96a78eb1c440e43c42a427af229765e948c12a96e16b1ecd176e77ad5.json`
- `/tmp/renaiss-rag-2026-10-06/regressions/versions/official_knowledge/indexes/cdcbda31c50015b8d14e65bd651247d52847ee3e1576eda376d4fed1dd957929.json`
- `/tmp/renaiss-rag-2026-10-06/regressions/versions/official_knowledge/indexes/d5911026c81390fdf275cfa821ba78edcdc08305da159c11a159886175f0e963.json`
- `/tmp/renaiss-rag-2026-10-06/regressions/versions/official_knowledge/indexes/e742ab0c070e6cc620855b486b1a869d8e2b47634e042a08667be3e651a92f11.json`
- `/tmp/renaiss-rag-2026-10-06/regressions/versions/x_intel_embedding_cache.json`
- `/tmp/renaiss-rag-2026-10-06/validate_live.py`
- `/tmp/renaiss-rag-2026-10-06/wiki-http-headers.txt`
- `/tmp/renaiss-rag-2026-10-06/wiki-http.json`
- `/tmp/renaiss-rag-2026-10-06/wiki-source.json`
- `/tmp/renaiss-rag-2026-10-06/x_intel_feed.json`

### 本機新增 Python cache

- `/Users/gavin/renaiss_project/website/scripts/__pycache__/beginner_wiki.cpython-313.pyc`
- `/Users/gavin/renaiss_project/website/scripts/x_intel/__pycache__/official_knowledge.cpython-313.pyc`
- `/Users/gavin/renaiss_project/website/scripts/x_intel/__pycache__/knowledge_events.cpython-313.pyc`

### 現行 Zeabur 服務的隔離目錄

- `/tmp/renaiss-rag-20261006-01a11023/data/community_hub_auth.sqlite3`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-fair-ccd64309fe16fa6c8709d525f73f1fad36c4e0159972ed35e035f7fd6adb4165.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-fair-whitepaper-b0055e914453b1696f2942747a8ccb8ee7a27570f8db00b31a9087774fc79a7b.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-fair-whitepaper.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-fair.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-index-api-52089c0a819ca002d067755e31c06c99e26a6fb9f9d00591b89817c2ae264ecc.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-index-api.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-index-scope-877b7c7d228dbdff67ff2b7555bfbde3f16727748a5323c14101388969f4b522.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-index-scope.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/embeddings.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/indexes/37505985e93db66bd6a9974c7c4267c61dc1d6d90fa861abd5fae7c62025c7f3.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/x_intel_embedding_cache.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/x_intel_knowledge_memory.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/dated-events.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/fair-intro.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/fair-warm-final.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/fmv.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/index-intro.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/recent-events-final.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/recent-events.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/redeem.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/sbt-definition-final.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/sbt-definition.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/sbt-english.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/sbt-followup.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/sbt-transfer.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/tcg-photo.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/today-events-final.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/today-events.json`
- `/tmp/renaiss-rag-20261006-01a11023/review-evidence.json`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/__pycache__/beginner_wiki.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/beginner_wiki.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/__pycache__/embedding_cache.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/__pycache__/knowledge_agent.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/__pycache__/knowledge_events.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/__pycache__/official_knowledge.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/embedding_cache.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/knowledge_agent.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/knowledge_events.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/official_knowledge.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/official_sources.json`

### 舊 Zeabur 服務的隔離目錄

- `/tmp/renaiss-rag-20261006-01a11023/data/community_hub_auth.sqlite3`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-fair-ccd64309fe16fa6c8709d525f73f1fad36c4e0159972ed35e035f7fd6adb4165.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-fair-whitepaper-b0055e914453b1696f2942747a8ccb8ee7a27570f8db00b31a9087774fc79a7b.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-fair-whitepaper.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-fair.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-index-api-52089c0a819ca002d067755e31c06c99e26a6fb9f9d00591b89817c2ae264ecc.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-index-api.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-index-scope-877b7c7d228dbdff67ff2b7555bfbde3f16727748a5323c14101388969f4b522.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/documents/renaiss-index-scope.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/embeddings.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/official_knowledge/indexes/20c1e842defc3b2bf469ad86de54d18c5fd8d17a1fd5a957c4b5792ba57663a9.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/x_intel_embedding_cache.json`
- `/tmp/renaiss-rag-20261006-01a11023/data/x_intel_knowledge_memory.json`
- `/tmp/renaiss-rag-20261006-01a11023/results/sbt.json`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/__pycache__/beginner_wiki.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/beginner_wiki.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/__pycache__/embedding_cache.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/__pycache__/knowledge_agent.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/__pycache__/knowledge_events.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/__pycache__/official_knowledge.cpython-311.pyc`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/embedding_cache.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/knowledge_agent.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/knowledge_events.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/official_knowledge.py`
- `/tmp/renaiss-rag-20261006-01a11023/scripts/x_intel/official_sources.json`

## Push 與正式服務驗證追加記錄

Gavin 已明確同意 push，並確認不用在新手 Wiki 新增 Fair 章節；目標是 Agent 能回答 Renaiss Fair。Wiki hash 維持不變，section 搜尋沒有新增 Fair。

- 首次程式 commit：`b402184bd3e4c521de7e84375fba0e044f365b6d`，已 push `origin/main`。
- 自動部署 `6ac4d81a2501bae5587e4fb3`，RUNNING，完成時間 `2026-10-06T11:15:54.209Z`。
- `spec.source.dockerfile=null`；build log 先 `cloning repository https://github.com/Gavinzip/renaiss_website.git`，再 `load build definition from Dockerfile`；未修改覆寫或手動部署。
- `/app/scripts` 內 5 個修改模組／manifest 的 SHA-256 與 push 的本機檔案完全相同。
- 首頁、Wiki、client-release HTTP 200；HTML／API／release=no-store。hashed JS/CSS=gzip + 一年 immutable；439,290-byte JS 傳輸 132,360 bytes，130,901-byte CSS 傳輸 24,793 bytes。
- 既有網站素材合計 34,521,701 bytes；最大既有 JS 747,371 bytes，最大圖片 2,766,675 bytes，沒有 MP4／WebM；本次未新增 public／dist 素材。
- 正式 API cold index 建立成功：265 個常駐條目，同一常駐版本；後續 query index_cache_hit=true，回應 no-store。
- 正式程序社群記憶此時為 157 筆，generated `2026-10-05T15:59:44.443204+00:00`；與隔離快照 154 筆不同。常駐 Wiki／官方文件版本相同，未宣稱社群快照完全一致。
- 正式 SBT 不可交易題 HTTP 200、8.82 秒，引用 Wiki FAQ，未來用途保持條件。

### 介紹一下 Renaiss Fair。

Renaiss Fair 是一套強調可驗證公平性的抽卡（Gacha）機制，目標是讓玩家不需信任平台也能確認抽卡結果。

**核心設計：三大支柱（Pillars）** [1][2][3]

1. **Construction（建構）**：依據公開的 Fair Set Algorithm 產生卡包組合，每包都須符合固定的期望值（EV）範圍與各階稀有度的最小／最大張數限制，頂階收藏品保證出現，不會是「可能中、可能不中」。 [1][2]

2. **Seal（封存）**：卡包從 Renaiss 收藏品總庫中抽出，並在上架前以 Merkle root 記錄於鏈上，確保開賣後組合無法被竄改、增刪或替換。 [1][2]

3. **Draw（抽卡）**：每筆購買透過鏈上 post-commit 資料產生 ECVRF（elliptic curve verifiable random function，RFC 9381）輸出，再對剩餘卡片數取模數決定結果。任何人都能用公開金鑰重算並驗證該次抽取。 [1][2]

**解決的信任問題** [3]
傳統抽卡有兩個由平台獨自決定的環節：哪些卡進入卡包、買家實際拿到哪張。Renaiss Fair 透過公開規則與鏈上證據，讓「卡包組成」與「抽卡結果」都可獨立驗證。

**與一般平台的差異** [2]
- 一般平台：結果來自平台私有資料庫，玩家只能相信平台說法。
- Renaiss Fair：種子來自付款後才存在的鏈上資料，連 Renaiss 本人也無法在付款前預知結果，買家可自行重算驗證。

**補充說明**
- 上述機制的白皮書目前為 working draft（v1.0.0，2026-08-28）[1]。
- Renaiss 整體是部署於 BNB Chain 的 RWA 收藏品基礎設施，把實體 TCG 卡牌（如寶可夢、海賊王）轉為鏈上 NFT 資產[4]。Renaiss Fair 即是在此架構下，針對卡包開抽（gacha）環節所提供的可驗證方案。

引用：

- [Renaiss Fair — Gacha Whitepaper](https://fair.renaiss.xyz/whitepaper)
- [Renaiss Fair](https://fair.renaiss.xyz/)
- [Renaiss Fair — Gacha Whitepaper](https://fair.renaiss.xyz/whitepaper)
- [Renaiss 新手教學 — Renaiss 是什麼](https://renaiss.zeabur.app/beginner.html?lang=zh-Hant&topic=start)

HTTP=200; mode=rag; elapsed=27.03s; cache=no-store; official_index_cache_hit=false.

### Renaiss Fair 的 Merkle root 和 VRF 分別驗證什麼？

Merkle root 驗證「卡池組合是否被竄改」，VRF 驗證「抽到的確切卡牌是否可被重現」。

**Merkle root（第二柱・封存）**
- 將通過 Fair Set Algorithm 篩選的 Renaiss Collectibles 陣容在開賣前以 Merkle root 形式上鏈 commit [1][3]。
- 任何新增、移除或替換卡片的行為都會使 root 不再吻合，竄改會自我暴露 [2]。
- 它的作用是封存（seal）卡池組成，而非處理抽卡結果 [2]。

**VRF（第三柱・抽卡）**
- 付款後，以鏈上 post-commit 區塊資料產生種子，搭配 ECVRF 從仍可取得的收藏品中決定索引 [1][3]。
- 種子在買家付款前不存在，連 Renaiss 都無法預先計算，且任何人都能重播驗證 [2][4]。
- VRF 索引對應到 Merkle root 已 commit 的陣容中按唯一 token ID 排序的特定位置，證明指向「具體那一張卡」，而不只是稀有度 [2]。

簡言之：Merkle root 保證「開賣前卡池沒被動過」；VRF 保證「開賣後抽到哪張卡可被公開重現」。

引用：

- [Renaiss Fair — Gacha Whitepaper](https://fair.renaiss.xyz/whitepaper)
- [Renaiss Fair](https://fair.renaiss.xyz/)
- [Renaiss Fair — Gacha Whitepaper](https://fair.renaiss.xyz/whitepaper)
- [Renaiss Fair](https://fair.renaiss.xyz/)

HTTP=200; mode=rag; elapsed=13.56s; cache=no-store; official_index_cache_hit=true.

### 正式回歸發現的活動篩選漏網

首版正式近期活動 query 還引用「9/6 台灣 Renaiss 社區聚會開放報名」。row 的 date_role=registration_open，但獨立 event_facts.schedule 明載 `2026-09-06（週日）`。舊規則避免把報名日期當活动日期，將此类 meetup 一律歸為 timing_unconfirmed；模型雖說過期，來源仍進入 context。

補修正：只從獨立活動 schedule 的明確 ISO 年月日判斷已結束，不把發布／報名日期當活動日期；多日 schedule 取最後日期的隔日邊界。未來報名公告仍不直接提升為 confirmed active event，日期未知維持未知。5 項回歸通過（真實過期 row、未來公告、多日窗口、公告日期與活動日期不同、歷史查詢保留），另驗證 ISO 前綴／timestamp。inline 測試未生成持久測試檔，未新增 fallback。補修正隨本次授權 push，正式 follow-up query 結果另行回報。
