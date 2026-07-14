(function initCommunityHub() {
  const API_BASE = "";
  const INTEL_ORIGIN = "https://renaiss.zeabur.app";
  const LANGUAGE_STORAGE_KEY = "intel_ui_lang";
  const SUPPORTED_LANGUAGES = new Set(["zh-Hant", "zh-Hans", "en", "ko"]);
  const OFFICIAL_X_HANDLES = new Set(["renaissxyz"]);
  const OFFICIAL_DISCORD_GUILD_IDS = new Set(["1478788250687766796"]);
  const MAX_ROWS = 24;
  const HUB_VIEWS = new Set(["overview", "feed", "events", "sbt", "guide", "article", "records", "media", "knowledge"]);
  const DEFAULT_COVER_IMAGE = "./assets/renaiss-logo-640.png";
  const uiText = {
    "zh-Hant": {
      "top.legacy": "原始聚合器", "top.open": "Open Renaiss", "sidebar.label": "社群情報", "sidebar.wiki": "前往新手 Wiki", "sidebar.agent": "詢問 Renaiss Agent",
      "nav.overview": "總覽", "nav.feed": "社群動態", "nav.events": "活動", "nav.sbt": "SBT", "nav.records": "獎勵與紀錄", "nav.media": "新聞與媒體", "nav.knowledge": "知識與工具",
      "overview.loadingLead": "正在讀取 Renaiss 社群的即時情報。", "overview.eventsAction": "查看活動", "overview.feedAction": "看社群動態", "overview.sourceLabel": "資料來源", "overview.focusTitle": "正在發生", "overview.allEvents": "全部活動", "overview.signalTitle": "值得留意的訊號", "overview.allSignals": "全部消息",
      "feed.title": "社群動態", "feed.lead": "從目前追蹤來源中，整理實際標記 Renaiss 或被分類為社群內容的貼文；每一筆都可回到原始來源。", "events.title": "活動", "events.lead": "只顯示 Renaiss 官方活動牆中的近期、已公告與過去活動；第三方卡牌通路活動不會混入。", "sbt.title": "SBT", "sbt.lead": "先理解 SBT 的用途與取得原則，再查找目前可完成的任務。", "sbt.catalogTitle": "目前可取得的 SBT", "sbt.catalogLead": "保留原站列出的可完成任務與取得條件。",
      "records.title": "獎勵、得獎者與排行榜", "records.lead": "這裡只呈現可驗證的紀錄。社群活動排行來自目前 Intel Feed 的 Community Metrics；得獎者名單仍須接入正式結果資料才會顯示。", "records.winnersTitle": "得獎者與禮品", "records.rankTitle": "社群活動排行", "records.requirementsLabel": "需要的正式資料", "records.requirementOne": "活動或獎勵 ID、名稱與狀態", "records.requirementTwo": "得獎者／錢包或公開帳號、獎項與可驗證來源 URL", "records.requirementThree": "正式排行榜 API 的時間戳、範圍與計分規則",
      "media.title": "新聞與媒體", "media.lead": "官方公告、收藏與 TCG 市場情報都回到原始貼文或來源，避免把摘要當成唯一事實。", "knowledge.title": "知識與工具", "knowledge.lead": "保留原本已經存在的頁面與工具，各自負責最適合的工作，不把所有內容塞進這個 Hub。", "knowledge.wiki": "新手 Wiki", "knowledge.wikiSub": "開始使用、抽卡、SBT、卡牌與 FAQ", "knowledge.agent": "Renaiss Agent", "knowledge.agentSub": "直接問問題、追溯知識與來源", "knowledge.map": "聲量地圖", "knowledge.mapSub": "社群討論與地區分布", "knowledge.scanSub": "辨識與整理卡牌資料", "knowledge.profileSub": "查看自己的收藏與紀錄", "knowledge.gameSub": "進入 Renaiss 的互動世界",
      "filter.all": "全部", "filter.official": "官方", "filter.community": "社群", "filter.tagged": "標記 Renaiss", "filter.active": "近期官方", "filter.current": "目前", "filter.upcoming": "已公告", "filter.past": "過去活動", "filter.market": "市場與收藏", "sbt.filter.current": "目前可取得", "sbt.filter.upcoming": "已公告", "sbt.filter.past": "已結束 SBT", "action.refresh": "重新整理", "search.placeholder": "搜尋目前資料",
      "source.live": "Live Intel Feed", "source.updated": "更新於", "source.cards": "筆整理", "source.loading": "正在讀取即時資料...", "source.translating": "翻譯同步中", "source.translatingTitle": "正在完成這個語言的翻譯", "source.translatingBody": "內容會在翻譯完成後出現；不會混用原始語言。", "source.error": "即時資料讀取失敗。", "source.retry": "重試", "source.unavailable": "目前尚無符合這個條件的已驗證資料。", "source.winnerMissingTitle": "尚未接入得獎者資料來源", "source.winnerMissingBody": "目前的 Intel Feed 有活動與獎勵訊息，但沒有可驗證的得獎名單。接入活動結果資料或 Directus 紀錄後，這裡才會顯示。", "source.rankMissingTitle": "尚未接入社群活動排行", "source.rankMissingBody": "目前的 Intel Feed 尚未回傳 Community Metrics 帳號分數；Stephen 的正式排行榜 API 也尚未串接，因此這裡不會顯示假排名。", "source.metricsTitle": "Community Metrics · 社群活動快照", "source.metricsBody": "依目前追蹤社群帳號的貼文互動計算，並非 Stephen 的正式總排行榜。", "source.metricsWindow": "統計範圍", "source.metricsScore": "互動分數", "source.metricsPosts": "貼文", "source.metricsLikes": "喜歡", "source.metricsReplies": "回覆", "source.metricsBasis": "計分依據", "card.original": "查看原文", "card.official": "官方", "card.community": "社群", "card.active": "進行中", "card.upcoming": "已公告", "card.past": "已結束", "card.reference": "資料整理",
    },
    "zh-Hans": {
      "top.legacy": "原始聚合器", "top.open": "Open Renaiss", "sidebar.label": "社群情报", "sidebar.wiki": "前往新手 Wiki", "sidebar.agent": "询问 Renaiss Agent",
      "nav.overview": "总览", "nav.feed": "社群动态", "nav.events": "活动", "nav.sbt": "SBT", "nav.records": "奖励与记录", "nav.media": "新闻与媒体", "nav.knowledge": "知识与工具",
      "overview.loadingLead": "正在读取 Renaiss 社群的即时情报。", "overview.eventsAction": "查看活动", "overview.feedAction": "看社群动态", "overview.sourceLabel": "资料来源", "overview.focusTitle": "正在发生", "overview.allEvents": "全部活动", "overview.signalTitle": "值得留意的讯号", "overview.allSignals": "全部消息",
      "feed.title": "社群动态", "feed.lead": "从目前追踪来源中，整理实际标记 Renaiss 或被分类为社群内容的贴文；每一笔都可回到原始来源。", "events.title": "活动", "events.lead": "只显示 Renaiss 官方活动墙中的近期、已公告与过去活动；第三方卡牌渠道活动不会混入。", "sbt.title": "SBT", "sbt.lead": "先理解 SBT 的用途与获取原则，再查找目前可完成的任务。", "sbt.catalogTitle": "目前可获取的 SBT", "sbt.catalogLead": "保留原站列出的可完成任务与获取条件。",
      "records.title": "奖励、得奖者与排行榜", "records.lead": "这里只呈现可验证的记录。社群活动排行来自目前 Intel Feed 的 Community Metrics；得奖者名单仍须接入正式结果资料才会显示。", "records.winnersTitle": "得奖者与礼品", "records.rankTitle": "社群活动排行", "records.requirementsLabel": "需要的正式资料", "records.requirementOne": "活动或奖励 ID、名称与状态", "records.requirementTwo": "得奖者／钱包或公开帐号、奖项与可验证来源 URL", "records.requirementThree": "正式排行榜 API 的时间戳、范围与计分规则",
      "media.title": "新闻与媒体", "media.lead": "官方公告、收藏与 TCG 市场情报都回到原始贴文或来源，避免把摘要当成唯一事实。", "knowledge.title": "知识与工具", "knowledge.lead": "保留原本已经存在的页面与工具，各自负责最适合的工作，不把所有内容塞进这个 Hub。", "knowledge.wiki": "新手 Wiki", "knowledge.wikiSub": "开始使用、抽卡、SBT、卡牌与 FAQ", "knowledge.agent": "Renaiss Agent", "knowledge.agentSub": "直接问问题、追溯知识与来源", "knowledge.map": "声量地图", "knowledge.mapSub": "社群讨论与地区分布", "knowledge.scanSub": "识别与整理卡牌资料", "knowledge.profileSub": "查看自己的收藏与记录", "knowledge.gameSub": "进入 Renaiss 的互动世界",
      "filter.all": "全部", "filter.official": "官方", "filter.community": "社群", "filter.tagged": "标记 Renaiss", "filter.active": "近期官方", "filter.current": "目前", "filter.upcoming": "已公告", "filter.past": "过去活动", "filter.market": "市场与收藏", "sbt.filter.current": "目前可获取", "sbt.filter.upcoming": "已公布", "sbt.filter.past": "已结束 SBT", "action.refresh": "重新整理", "search.placeholder": "搜寻目前资料",
      "source.live": "Live Intel Feed", "source.updated": "更新于", "source.cards": "笔整理", "source.loading": "正在读取即时资料...", "source.translating": "翻译同步中", "source.translatingTitle": "正在完成这个语言的翻译", "source.translatingBody": "内容会在翻译完成后出现；不会混用原始语言。", "source.error": "即时资料读取失败。", "source.retry": "重试", "source.unavailable": "目前尚无符合这个条件的已验证资料。", "source.winnerMissingTitle": "尚未接入得奖者资料来源", "source.winnerMissingBody": "目前的 Intel Feed 有活动与奖励讯息，但没有可验证的得奖名单。接入活动结果资料或 Directus 记录后，这里才会显示。", "source.rankMissingTitle": "尚未接入社群活动排行", "source.rankMissingBody": "目前的 Intel Feed 尚未回传 Community Metrics 帐号分数；Stephen 的正式排行榜 API 也尚未串接，因此这里不会显示假排名。", "source.metricsTitle": "Community Metrics · 社群活动快照", "source.metricsBody": "依目前追踪社群帐号的贴文互动计算，并非 Stephen 的正式总排行榜。", "source.metricsWindow": "统计范围", "source.metricsScore": "互动分数", "source.metricsPosts": "贴文", "source.metricsLikes": "喜欢", "source.metricsReplies": "回复", "source.metricsBasis": "计分依据", "card.original": "查看原文", "card.official": "官方", "card.community": "社群", "card.active": "进行中", "card.upcoming": "已公告", "card.past": "已结束", "card.reference": "资料整理"
    },
    en: {
      "top.legacy": "Original Aggregator", "top.open": "Open Renaiss", "sidebar.label": "Community Intel", "sidebar.wiki": "Open Beginner Wiki", "sidebar.agent": "Ask Renaiss Agent",
      "nav.overview": "Overview", "nav.feed": "Community Feed", "nav.events": "Events", "nav.sbt": "SBT", "nav.records": "Rewards & Records", "nav.media": "News & Media", "nav.knowledge": "Knowledge & Tools",
      "overview.loadingLead": "Loading live Renaiss community intelligence.", "overview.eventsAction": "View events", "overview.feedAction": "Open community feed", "overview.sourceLabel": "Source", "overview.focusTitle": "Happening now", "overview.allEvents": "All events", "overview.signalTitle": "Signals worth watching", "overview.allSignals": "All updates",
      "feed.title": "Community feed", "feed.lead": "Posts from the current tracked sources that explicitly tag Renaiss or are classified as community content. Every item links back to its original source.", "events.title": "Events", "events.lead": "Only official Renaiss event-wall items are shown as recent, announced, or past events. Third-party card-channel activity is excluded.", "sbt.title": "SBT", "sbt.lead": "Understand what SBTs represent and how they are earned before looking through tasks available now.", "sbt.catalogTitle": "SBTs available now", "sbt.catalogLead": "The original site’s active tasks and their requirements are preserved here.",
      "records.title": "Rewards, winners, and rankings", "records.lead": "Only verifiable records belong here. The community activity ranking uses Community Metrics in the current Intel Feed; winner rosters remain hidden until an official results source is connected.", "records.winnersTitle": "Winners and gifts", "records.rankTitle": "Community activity ranking", "records.requirementsLabel": "Required verified data", "records.requirementOne": "Event or reward ID, name, and status", "records.requirementTwo": "Winner, wallet or public handle, prize, and verifiable source URL", "records.requirementThree": "Official ranking API timestamp, scope, and scoring rules",
      "media.title": "News and media", "media.lead": "Official announcements, collectibles, and TCG market intelligence always lead back to the original post or source. A summary is not the only fact.", "knowledge.title": "Knowledge and tools", "knowledge.lead": "Existing pages and tools remain in their proper roles instead of being crammed into this Hub.", "knowledge.wiki": "Beginner Wiki", "knowledge.wikiSub": "Getting started, packs, SBT, cards, and FAQ", "knowledge.agent": "Renaiss Agent", "knowledge.agentSub": "Ask questions and trace knowledge and sources", "knowledge.map": "Community Map", "knowledge.mapSub": "Community discussions and regional distribution", "knowledge.scanSub": "Recognize and organize card data", "knowledge.profileSub": "View your collection and history", "knowledge.gameSub": "Enter the interactive Renaiss world",
      "filter.all": "All", "filter.official": "Official", "filter.community": "Community", "filter.tagged": "Tagged Renaiss", "filter.active": "Recent official", "filter.current": "Current", "filter.upcoming": "Announced", "filter.past": "Past", "filter.market": "Market & Collectibles", "sbt.filter.current": "Available now", "sbt.filter.upcoming": "Announced", "sbt.filter.past": "Ended SBTs", "action.refresh": "Refresh", "search.placeholder": "Search current data",
      "source.live": "Live Intel Feed", "source.updated": "Updated", "source.cards": "items", "source.loading": "Loading live data...", "source.translating": "Translation sync in progress", "source.translatingTitle": "Completing translation for this language", "source.translatingBody": "Content appears after translation completes; source-language text is not mixed in.", "source.error": "Live data could not be loaded.", "source.retry": "Retry", "source.unavailable": "There is no verified data for this filter yet.", "source.winnerMissingTitle": "No winner source is connected", "source.winnerMissingBody": "The Intel Feed includes event and reward information but not a verifiable winner roster. This view opens after event-result data or Directus records are connected.", "source.rankMissingTitle": "No community activity ranking is connected", "source.rankMissingBody": "The current Intel Feed did not return Community Metrics account scores, and Stephen's official ranking API is not connected, so this view does not show invented positions.", "source.metricsTitle": "Community Metrics · activity snapshot", "source.metricsBody": "Calculated from tracked community-account post interactions. This is not Stephen's official global ranking.", "source.metricsWindow": "Window", "source.metricsScore": "Interaction score", "source.metricsPosts": "Posts", "source.metricsLikes": "Likes", "source.metricsReplies": "Replies", "source.metricsBasis": "Score basis", "card.original": "Original source", "card.official": "Official", "card.community": "Community", "card.active": "Active", "card.upcoming": "Announced", "card.past": "Ended", "card.reference": "Intel record"
    },
    ko: {
      "top.legacy": "기존 애그리게이터", "top.open": "Renaiss 열기", "sidebar.label": "커뮤니티 인텔", "sidebar.wiki": "초보자 Wiki 열기", "sidebar.agent": "Renaiss Agent에게 묻기",
      "nav.overview": "개요", "nav.feed": "커뮤니티 피드", "nav.events": "이벤트", "nav.sbt": "SBT", "nav.records": "보상 및 기록", "nav.media": "뉴스 및 미디어", "nav.knowledge": "지식 및 도구",
      "overview.loadingLead": "Renaiss 커뮤니티 실시간 인텔을 불러오는 중입니다.", "overview.eventsAction": "이벤트 보기", "overview.feedAction": "커뮤니티 피드 보기", "overview.sourceLabel": "출처", "overview.focusTitle": "지금 진행 중", "overview.allEvents": "모든 이벤트", "overview.signalTitle": "주목할 신호", "overview.allSignals": "모든 업데이트",
      "feed.title": "커뮤니티 피드", "feed.lead": "현재 추적 중인 출처에서 Renaiss를 명시적으로 태그했거나 커뮤니티 콘텐츠로 분류된 글을 정리합니다. 모든 항목은 원문으로 연결됩니다.", "events.title": "이벤트", "events.lead": "Renaiss 공식 이벤트 월의 최근, 공지, 과거 이벤트만 표시합니다. 제3자 카드 채널 활동은 제외합니다.", "sbt.title": "SBT", "sbt.lead": "SBT의 의미와 획득 원칙을 먼저 이해한 뒤, 지금 완료할 수 있는 과제를 확인하세요.", "sbt.catalogTitle": "현재 획득 가능한 SBT", "sbt.catalogLead": "원본 사이트의 진행 가능한 과제와 획득 조건을 그대로 유지합니다.",
      "records.title": "보상, 수상자, 랭킹", "records.lead": "검증 가능한 기록만 표시합니다. 커뮤니티 활동 순위는 현재 Intel Feed의 Community Metrics를 사용하며, 수상자 명단은 공식 결과 출처가 연결된 뒤에만 표시됩니다.", "records.winnersTitle": "수상자와 선물", "records.rankTitle": "커뮤니티 활동 순위", "records.requirementsLabel": "필요한 검증 데이터", "records.requirementOne": "이벤트 또는 보상 ID, 이름, 상태", "records.requirementTwo": "수상자, 지갑 또는 공개 계정, 경품, 검증 URL", "records.requirementThree": "공식 랭킹 API의 시각, 범위, 점수 규칙",
      "media.title": "뉴스와 미디어", "media.lead": "공식 발표, 컬렉터블, TCG 시장 인텔은 항상 원문이나 출처로 연결됩니다. 요약만이 유일한 사실은 아닙니다.", "knowledge.title": "지식과 도구", "knowledge.lead": "이미 존재하는 페이지와 도구를 이 Hub에 모두 넣지 않고 각자 적절한 역할로 유지합니다.", "knowledge.wiki": "초보자 Wiki", "knowledge.wikiSub": "시작하기, 팩, SBT, 카드, FAQ", "knowledge.agent": "Renaiss Agent", "knowledge.agentSub": "질문하고 지식과 출처를 추적하세요", "knowledge.map": "커뮤니티 맵", "knowledge.mapSub": "커뮤니티 대화와 지역 분포", "knowledge.scanSub": "카드 데이터를 인식하고 정리", "knowledge.profileSub": "내 컬렉션과 기록 보기", "knowledge.gameSub": "인터랙티브 Renaiss 세계로 이동",
      "filter.all": "전체", "filter.official": "공식", "filter.community": "커뮤니티", "filter.tagged": "Renaiss 태그", "filter.active": "최근 공식", "filter.current": "현재", "filter.upcoming": "공지됨", "filter.past": "과거", "filter.market": "시장 및 컬렉터블", "sbt.filter.current": "현재 획득 가능", "sbt.filter.upcoming": "공지됨", "sbt.filter.past": "종료된 SBT", "action.refresh": "새로고침", "search.placeholder": "현재 데이터 검색",
      "source.live": "Live Intel Feed", "source.updated": "업데이트", "source.cards": "개 항목", "source.loading": "실시간 데이터를 불러오는 중...", "source.translating": "번역 동기화 중", "source.translatingTitle": "이 언어의 번역을 완료하는 중", "source.translatingBody": "번역이 완료된 뒤에 콘텐츠가 표시되며 원문 언어를 섞지 않습니다.", "source.error": "실시간 데이터를 불러오지 못했습니다.", "source.retry": "다시 시도", "source.unavailable": "이 필터에 해당하는 검증된 데이터가 아직 없습니다.", "source.winnerMissingTitle": "수상자 출처가 연결되지 않았습니다", "source.winnerMissingBody": "Intel Feed에는 이벤트와 보상 정보가 있지만 검증 가능한 수상자 명단은 없습니다. 이벤트 결과 데이터 또는 Directus 기록이 연결되면 이 화면이 열립니다.", "source.rankMissingTitle": "커뮤니티 활동 순위가 연결되지 않았습니다", "source.rankMissingBody": "현재 Intel Feed가 Community Metrics 계정 점수를 반환하지 않았고 Stephen의 공식 랭킹 API도 연결되지 않아 임의의 순위를 표시하지 않습니다.", "source.metricsTitle": "Community Metrics · 활동 스냅샷", "source.metricsBody": "추적 중인 커뮤니티 계정의 게시물 상호작용으로 계산됩니다. Stephen의 공식 글로벌 랭킹은 아닙니다.", "source.metricsWindow": "집계 범위", "source.metricsScore": "상호작용 점수", "source.metricsPosts": "게시물", "source.metricsLikes": "좋아요", "source.metricsReplies": "답글", "source.metricsBasis": "점수 기준", "card.original": "원문 보기", "card.official": "공식", "card.community": "커뮤니티", "card.active": "진행 중", "card.upcoming": "공지됨", "card.past": "종료", "card.reference": "인텔 기록"
    }
  };

  Object.assign(uiText["zh-Hant"], {
    "overview.sbtTitle": "限時 SBT 活動", "overview.allSbt": "查看 SBT 專區", "overview.sbtEmpty": "目前沒有具明確截止日、仍在有效期內的官方限時 SBT 活動。常駐任務請到新手教學查看。", "overview.routesTitle": "從這裡開始",
    "overview.routeFeed": "社群動態", "overview.routeFeedSub": "追蹤官方與社群的最新訊號", "overview.routeEvents": "活動", "overview.routeEventsSub": "只看 Renaiss 官方活動狀態", "overview.routeSbt": "SBT", "overview.routeSbtSub": "查看限時活動、官方文章與新手任務入口", "overview.routeRecords": "獎勵與紀錄", "overview.routeRecordsSub": "只顯示可驗證的結果與排行", "overview.routeWiki": "新手 Wiki", "overview.routeWikiSub": "學習規則、SBT 與工具使用方式"
  });
  Object.assign(uiText["zh-Hans"], {
    "overview.sbtTitle": "限时 SBT 活动", "overview.allSbt": "查看 SBT 专区", "overview.sbtEmpty": "目前没有具明确截止日、仍在有效期内的官方限时 SBT 活动。常驻任务请到新手教学查看。", "overview.routesTitle": "从这里开始",
    "overview.routeFeed": "社群动态", "overview.routeFeedSub": "追踪官方与社群的最新讯号", "overview.routeEvents": "活动", "overview.routeEventsSub": "只看 Renaiss 官方活动状态", "overview.routeSbt": "SBT", "overview.routeSbtSub": "查看限时活动、官方文章与新手任务入口", "overview.routeRecords": "奖励与记录", "overview.routeRecordsSub": "只显示可验证的结果与排行", "overview.routeWiki": "新手 Wiki", "overview.routeWikiSub": "学习规则、SBT 与工具使用方式"
  });
  Object.assign(uiText.en, {
    "overview.sbtTitle": "Time-limited SBT campaigns", "overview.allSbt": "Open SBT hub", "overview.sbtEmpty": "There is no official time-limited SBT campaign with a verified active deadline right now. Find evergreen tasks in the Beginner Guide.", "overview.routesTitle": "Start here",
    "overview.routeFeed": "Community feed", "overview.routeFeedSub": "Track the latest official and community signals", "overview.routeEvents": "Events", "overview.routeEventsSub": "See official Renaiss event status only", "overview.routeSbt": "SBT", "overview.routeSbtSub": "See limited campaigns, official articles, and beginner-task entry points", "overview.routeRecords": "Rewards & records", "overview.routeRecordsSub": "Only verifiable results and rankings", "overview.routeWiki": "Beginner Wiki", "overview.routeWikiSub": "Learn rules, SBTs, and tools"
  });
  Object.assign(uiText.ko, {
    "overview.sbtTitle": "기간 한정 SBT 캠페인", "overview.allSbt": "SBT 허브 열기", "overview.sbtEmpty": "명확한 마감일이 확인된 진행 중 공식 기간 한정 SBT 캠페인이 현재 없습니다. 상시 과제는 초보자 가이드에서 확인하세요.", "overview.routesTitle": "여기서 시작하세요",
    "overview.routeFeed": "커뮤니티 피드", "overview.routeFeedSub": "공식 및 커뮤니티의 최신 신호 추적", "overview.routeEvents": "이벤트", "overview.routeEventsSub": "Renaiss 공식 이벤트 상태만 확인", "overview.routeSbt": "SBT", "overview.routeSbtSub": "기간 한정 캠페인, 공식 글, 초보자 과제 진입점 확인", "overview.routeRecords": "보상 및 기록", "overview.routeRecordsSub": "검증 가능한 결과와 랭킹만 표시", "overview.routeWiki": "초보자 Wiki", "overview.routeWikiSub": "규칙, SBT 및 도구 학습"
  });

  Object.assign(uiText["zh-Hant"], {
    "knowledge.guideTitle": "原始新手 Wiki", "knowledge.guideLead": "各篇原始教學仍保留在自己的頁面，從對應主題直接進入。", "knowledge.start": "開始使用", "knowledge.startSub": "錢包、註冊與充值前的準備", "knowledge.packs": "抽卡與回購", "knowledge.packsSub": "限時卡池、無限卡機與 FMV", "knowledge.market": "Marketplace", "knowledge.marketSub": "買賣、競拍與交易積分", "knowledge.sbt": "SBT 任務", "knowledge.sbtSub": "SBT 用途、取得原則與可完成任務", "knowledge.tcg": "TCG 基礎", "knowledge.tcgSub": "收藏、評級、查價與市場判讀", "knowledge.tools": "工具", "knowledge.toolsSub": "社群工具與 TCG Pro 指令", "knowledge.faq": "FAQ", "knowledge.faqSub": "新手常見問題與解答"
  });
  Object.assign(uiText["zh-Hans"], {
    "knowledge.guideTitle": "原始新手 Wiki", "knowledge.guideLead": "各篇原始教学仍保留在自己的页面，从对应主题直接进入。", "knowledge.start": "开始使用", "knowledge.startSub": "钱包、注册与充值前的准备", "knowledge.packs": "抽卡与回购", "knowledge.packsSub": "限时卡池、无限卡机与 FMV", "knowledge.market": "Marketplace", "knowledge.marketSub": "买卖、竞拍与交易积分", "knowledge.sbt": "SBT 任务", "knowledge.sbtSub": "SBT 用途、获取原则与可完成任务", "knowledge.tcg": "TCG 基础", "knowledge.tcgSub": "收藏、评级、查价与市场判断", "knowledge.tools": "工具", "knowledge.toolsSub": "社群工具与 TCG Pro 指令", "knowledge.faq": "FAQ", "knowledge.faqSub": "新手常见问题与解答"
  });
  Object.assign(uiText.en, {
    "knowledge.guideTitle": "Original Beginner Wiki", "knowledge.guideLead": "Each original guide remains on its own page and opens at the matching topic.", "knowledge.start": "Getting started", "knowledge.startSub": "Wallet, registration, and funding preparation", "knowledge.packs": "Packs and buyback", "knowledge.packsSub": "Limited pools, infinite packs, and FMV", "knowledge.market": "Marketplace", "knowledge.marketSub": "Buy, sell, bid, and trading points", "knowledge.sbt": "SBT tasks", "knowledge.sbtSub": "SBT purpose, earning principles, and active tasks", "knowledge.tcg": "TCG basics", "knowledge.tcgSub": "Collecting, grading, pricing, and market judgment", "knowledge.tools": "Tools", "knowledge.toolsSub": "Community tools and TCG Pro commands", "knowledge.faq": "FAQ", "knowledge.faqSub": "Common beginner questions and answers"
  });
  Object.assign(uiText.ko, {
    "knowledge.guideTitle": "원본 초보자 Wiki", "knowledge.guideLead": "원본 가이드는 각 주제 페이지에 유지되며 해당 주제로 바로 이동합니다.", "knowledge.start": "시작하기", "knowledge.startSub": "지갑, 가입, 입금 전 준비", "knowledge.packs": "팩과 바이백", "knowledge.packsSub": "한정 풀, 무한 팩, FMV", "knowledge.market": "Marketplace", "knowledge.marketSub": "구매, 판매, 입찰, 거래 포인트", "knowledge.sbt": "SBT 과제", "knowledge.sbtSub": "SBT 용도, 획득 원칙, 진행 가능한 과제", "knowledge.tcg": "TCG 기초", "knowledge.tcgSub": "수집, 등급, 가격, 시장 판단", "knowledge.tools": "도구", "knowledge.toolsSub": "커뮤니티 도구와 TCG Pro 명령어", "knowledge.faq": "FAQ", "knowledge.faqSub": "초보자가 자주 묻는 질문과 답변"
  });

  Object.assign(uiText["zh-Hant"], {
    "nav.guide": "新手教學", "nav.article": "文章", "guide.title": "新手教學", "guide.lead": "保留完整的獨立教學內容；一次只閱讀一個章節，並可從左側切換。", "sbt.lead": "先用簡短導讀理解 SBT，再閱讀原本分類中的即時文章與取得資訊。", "sbt.acquisitionTitle": "取得中的 SBT", "sbt.acquisitionLead": "由目前的 SBT 相關公告整理出的名稱與取得資訊；會保留各自的原文出處。", "sbt.articleTitle": "SBT 相關文章", "sbt.articleLead": "從原本 SBT 分類保留的即時文章。點進去在 Hub 內閱讀，再回到原始貼文核對。", "sbt.guideActionTitle": "完整 SBT 新手教學", "sbt.guideActionLead": "查看基礎說明與目前可完成的任務清單", "knowledge.guideTitle": "完整新手教學", "knowledge.guideLead": "以獨立章節閱讀開始使用、抽卡、SBT、卡牌與 FAQ，不需要在資訊流中翻找。", "knowledge.guideActionTitle": "開啟新手教學", "knowledge.guideActionLead": "從開始使用一路看到 SBT、工具與 FAQ", "article.back": "返回 SBT 文章", "article.original": "查看原始貼文", "article.unavailable": "這篇文章已不在目前的即時資料集中。請回到 SBT 文章列表重新選擇。", "article.source": "來源與時間", "article.details": "文章重點", "article.sbt": "SBT 取得資訊"
  });
  Object.assign(uiText["zh-Hans"], {
    "nav.guide": "新手教学", "nav.article": "文章", "guide.title": "新手教学", "guide.lead": "保留完整的独立教学内容；一次只阅读一个章节，并可从左侧切换。", "sbt.lead": "先用简短导读理解 SBT，再阅读原本分类中的即时文章与获取资讯。", "sbt.acquisitionTitle": "获取中的 SBT", "sbt.acquisitionLead": "由目前的 SBT 相关文章整理出的名称与获取资讯；会保留各自的原文出处。", "sbt.articleTitle": "SBT 相关文章", "sbt.articleLead": "从原本 SBT 分类保留的即时文章。点进去在 Hub 内阅读，再回到原始贴文核对。", "sbt.guideActionTitle": "完整 SBT 新手教学", "sbt.guideActionLead": "查看基础说明与目前可完成的任务清单", "knowledge.guideTitle": "完整新手教学", "knowledge.guideLead": "以独立章节阅读开始使用、抽卡、SBT、卡牌与 FAQ，不需要在资讯流中翻找。", "knowledge.guideActionTitle": "打开新手教学", "knowledge.guideActionLead": "从开始使用一路看到 SBT、工具与 FAQ", "article.back": "返回 SBT 文章", "article.original": "查看原始贴文", "article.unavailable": "这篇文章已不在目前的即时资料集中。请回到 SBT 文章列表重新选择。", "article.source": "来源与时间", "article.details": "文章重点", "article.sbt": "SBT 获取资讯"
  });
  Object.assign(uiText.en, {
    "nav.guide": "Beginner Guide", "nav.article": "Article", "guide.title": "Beginner Guide", "guide.lead": "Keep the complete learning path separate. Read one chapter at a time and switch topics from the left rail.", "sbt.lead": "Start with a short SBT primer, then read the live articles and acquisition information preserved from the original category.", "sbt.acquisitionTitle": "SBTs being earned", "sbt.acquisitionLead": "Names and acquisition details extracted from current SBT announcements, each retaining its original source.", "sbt.articleTitle": "SBT articles", "sbt.articleLead": "Live articles preserved from the original SBT category. Read them in the Hub, then verify against the original post.", "sbt.guideActionTitle": "Complete SBT beginner guide", "sbt.guideActionLead": "Read the fundamentals and the active task catalog", "knowledge.guideTitle": "Complete beginner guide", "knowledge.guideLead": "Read Getting started, packs, SBTs, cards, tools, and FAQ as separate chapters instead of hunting through a feed.", "knowledge.guideActionTitle": "Open beginner guide", "knowledge.guideActionLead": "Start with setup, then move through SBTs, tools, and FAQ", "article.back": "Back to SBT articles", "article.original": "Open original post", "article.unavailable": "This article is no longer in the current live dataset. Return to the SBT article list and choose another item.", "article.source": "Source and time", "article.details": "Article details", "article.sbt": "SBT acquisition information"
  });
  Object.assign(uiText.ko, {
    "nav.guide": "초보자 가이드", "nav.article": "글", "guide.title": "초보자 가이드", "guide.lead": "완전한 학습 경로를 분리해 유지합니다. 한 번에 한 챕터를 읽고 왼쪽에서 주제를 전환하세요.", "sbt.lead": "짧은 SBT 안내 후, 원래 분류에서 보존한 실시간 글과 획득 정보를 읽어보세요.", "sbt.acquisitionTitle": "현재 획득 가능한 SBT", "sbt.acquisitionLead": "현재 SBT 공지에서 정리한 이름과 획득 정보이며 각 원문 출처를 유지합니다.", "sbt.articleTitle": "SBT 관련 글", "sbt.articleLead": "원본 SBT 분류에서 보존한 실시간 글입니다. Hub에서 읽은 뒤 원문으로 확인하세요.", "sbt.guideActionTitle": "전체 SBT 초보자 가이드", "sbt.guideActionLead": "기초 설명과 현재 가능한 과제 목록 보기", "knowledge.guideTitle": "전체 초보자 가이드", "knowledge.guideLead": "시작하기, 팩, SBT, 카드, 도구, FAQ를 피드에서 찾지 않고 독립 챕터로 읽습니다.", "knowledge.guideActionTitle": "초보자 가이드 열기", "knowledge.guideActionLead": "시작하기부터 SBT, 도구, FAQ까지 보기", "article.back": "SBT 글 목록으로", "article.original": "원문 보기", "article.unavailable": "이 글은 현재 실시간 데이터셋에 없습니다. SBT 글 목록으로 돌아가 다른 항목을 선택하세요.", "article.source": "출처와 시간", "article.details": "글 핵심", "article.sbt": "SBT 획득 정보"
  });

  const state = {
    lang: getSavedLanguage(),
    feed: null,
    view: readInitialView(),
    guideTopic: readGuideTopic(),
    articleUrl: readArticleUrl(),
    filters: { feed: "all", events: "active", media: "official" },
    search: "",
    controller: null,
    loading: false,
    hasMountedView: false,
    translationRetryTimer: 0,
    translationRetries: 0
  };

  const sbtCopy = {
    "zh-Hant": { acquisition: "取得方式", difficulty: "難度" },
    "zh-Hans": { acquisition: "获取方式", difficulty: "难度" },
    en: { acquisition: "How to get it", difficulty: "Difficulty" },
    ko: { acquisition: "획득 방법", difficulty: "난이도" }
  };

  const resultCopy = {
    "zh-Hant": { title: "官方得獎與獎勵公告", lead: "只列出 Renaiss 官方帳號或官方 Discord 的結果公告；個別得獎者以原文與原圖為準。", status: "官方結果" },
    "zh-Hans": { title: "官方获奖与奖励公告", lead: "只列出 Renaiss 官方帐号或官方 Discord 的结果公告；个别获奖者以原文与原图为准。", status: "官方结果" },
    en: { title: "Official winner and reward announcements", lead: "Only result announcements from Renaiss official accounts or the official Discord are listed. Refer to each original post and image for individual winners.", status: "Official result" },
    ko: { title: "공식 수상 및 보상 공지", lead: "Renaiss 공식 계정 또는 공식 Discord의 결과 공지만 표시합니다. 개별 수상자는 각 원문과 이미지를 기준으로 확인하세요.", status: "공식 결과" }
  };

  function normalizeLanguage(value) {
    const raw = String(value || "").trim();
    if (SUPPORTED_LANGUAGES.has(raw)) return raw;
    if (/^zh(-|_)?cn|zh-hans/i.test(raw)) return "zh-Hans";
    if (/^ko/i.test(raw)) return "ko";
    if (/^en/i.test(raw)) return "en";
    return "zh-Hant";
  }

  function getSavedLanguage() {
    try {
      return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || document.documentElement.lang || navigator.language);
    } catch (_error) {
      return normalizeLanguage(document.documentElement.lang || navigator.language);
    }
  }

  function readInitialView() {
    const raw = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (HUB_VIEWS.has(raw)) return raw;
    if (readArticleUrl()) return "article";
    if (readGuideTopic()) return "guide";
    return "overview";
  }

  function guideTopicIds() {
    const ids = window.RENAISS_COMMUNITY_GUIDE?.topicIds;
    return Array.isArray(ids) && ids.length ? ids : ["start", "packs", "market", "sbt", "tcg", "tools", "faq"];
  }

  function readGuideTopic() {
    const topic = String(new URLSearchParams(window.location.search).get("guide") || "").trim().toLowerCase();
    return guideTopicIds().includes(topic) ? topic : String(window.RENAISS_COMMUNITY_GUIDE?.defaultTopic || "start");
  }

  function readArticleUrl() {
    return safeUrl(new URLSearchParams(window.location.search).get("article"));
  }

  function t(key) {
    const copy = uiText[state.lang] || uiText["zh-Hant"];
    return String(copy[key] || uiText["zh-Hant"][key] || key);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeUrl(value) {
    const raw = String(value || "").trim();
    if (!/^https?:\/\//i.test(raw)) return "";
    try { return new URL(raw).href; } catch (_error) { return ""; }
  }

  function safeCoverUrl(value) {
    const raw = String(value || "").trim();
    if (/^\/data\/generated_covers\//.test(raw)) return `${INTEL_ORIGIN}${raw}`;
    return safeUrl(raw);
  }

  function defaultCoverLabel() {
    const labels = {
      "zh-Hant": "Renaiss Community 預設封面",
      "zh-Hans": "Renaiss Community 默认封面",
      en: "Renaiss Community default cover",
      ko: "Renaiss Community 기본 표지"
    };
    return labels[state.lang] || labels["zh-Hant"];
  }

  function defaultCoverHtml(className) {
    const label = defaultCoverLabel();
    return `<div class="${escapeHtml(className)} ${escapeHtml(className)}--default" role="img" aria-label="${escapeHtml(label)}"><img src="${DEFAULT_COVER_IMAGE}" alt="" decoding="async" /><span>${escapeHtml(label)}</span></div>`;
  }

  function toDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  function formatDate(value) {
    const date = toDate(value);
    if (!date) return "--";
    const locale = state.lang === "zh-Hans" ? "zh-CN" : state.lang === "ko" ? "ko-KR" : state.lang === "en" ? "en-US" : "zh-TW";
    return date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  }

  function formatUpdate(value) {
    const date = toDate(value);
    if (!date) return "--";
    const locale = state.lang === "zh-Hans" ? "zh-CN" : state.lang === "ko" ? "ko-KR" : state.lang === "en" ? "en-US" : "zh-TW";
    return date.toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function normalizeCards(feed) {
    const cards = Array.isArray(feed?.cards) ? feed.cards : [];
    return cards
      .filter((card) => card && typeof card === "object" && String(card.dedupe_status || "") !== "dropped")
      .filter((card) => state.lang === "zh-Hant" || String(card?._i18n_status?.status || "") === "translated")
      .map((card) => ({ ...card, topics: Array.isArray(card.topic_labels) ? card.topic_labels.map((x) => String(x || "").toLowerCase()) : [] }))
      .sort((a, b) => Number(toDate(b.published_at) || 0) - Number(toDate(a.published_at) || 0));
  }

  function isOfficial(card) {
    const account = String(card.account || "").trim().replace(/^@+/, "").toLowerCase();
    const source = safeUrl(card.url);
    if (OFFICIAL_X_HANDLES.has(account) || /(?:x|twitter)\.com\/renaissxyz(?:\/|$)/i.test(source)) return true;
    const guildMatch = source.match(/^https:\/\/discord\.com\/channels\/(?:@me\/)?(\d+)\//i);
    return Boolean(guildMatch && OFFICIAL_DISCORD_GUILD_IDS.has(guildMatch[1]));
  }

  function isTaggedRenaiss(card) {
    const text = [card.raw_text, card.title, card.summary, ...(Array.isArray(card.tags) ? card.tags : [])].join(" ");
    return /(?:#renaiss\b|@renaissxyz\b)/i.test(text);
  }

  function isCommunity(card) {
    return card.topics.includes("community") || (!isOfficial(card) && isTaggedRenaiss(card));
  }

  function isEvent(card) {
    return isOfficial(card) && card.event_wall === true;
  }

  function isSbt(card) {
    const text = [card.title, card.summary, card.raw_text, card.sbt_name, card.sbt_acquisition, ...(Array.isArray(card.sbt_names) ? card.sbt_names : [])].join(" ");
    return card.topics.includes("sbt") || /\bSBT\b/i.test(text);
  }

  function isVerifiedResult(card) {
    if (!isOfficial(card)) return false;
    const text = [card.title, card.summary, card.raw_text].join(" ");
    return /(?:\bwinners?\s+(?:are|is|were|have been|revealed|live|announced)|\bresults?\s+(?:are|is|were|live|announced)|(?:lucky draw|giveaway).{0,64}(?:winner|result)|中獎|得獎|獲獎|中奖|获奖|수상|抽獎結果|抽奖结果|(?:獎勵|奖励|rewards?).{0,24}(?:完成|發放|发放|complete|sent))/i.test(text);
  }

  function isMedia(card) {
    return isOfficial(card) || card.topics.includes("collectibles") || card.topics.includes("pokemon") || ["announcement", "market", "report", "trend"].includes(String(card.card_type || "").toLowerCase());
  }

  function temporalStatus(card) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = toDate(card.timeline_date) || toDate(card.published_at);
    const end = toDate(card.timeline_end_date) || toDate(card.timeline_date) || start;
    if (!start) return "reference";
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (startDay > now) return "upcoming";
    if (endDay >= now) return "active";
    return "past";
  }

  function eventStatus(card) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = toDate(card.timeline_date) || toDate(card.published_at);
    const explicitEnd = toDate(card.timeline_end_date);
    if (!start) return "reference";
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    if (startDay > now) return "upcoming";
    if (explicitEnd) {
      const endDay = new Date(explicitEnd.getFullYear(), explicitEnd.getMonth(), explicitEnd.getDate());
      if (endDay >= now) return "active";
    }
    const daysSinceStart = Math.floor((now.valueOf() - startDay.valueOf()) / 86400000);
    return daysSinceStart <= 14 ? "active" : "past";
  }

  function labelForStatus(status) {
    if (status === "active") return t("card.active");
    if (status === "upcoming") return t("card.upcoming");
    if (status === "past") return t("card.past");
    return t("card.reference");
  }

  function eventStatusLabel(status) {
    const labels = {
      "zh-Hant": { active: "近期官方活動", upcoming: "已公告", past: "過去活動", reference: "官方活動" },
      "zh-Hans": { active: "近期官方活动", upcoming: "已公告", past: "过去活动", reference: "官方活动" },
      en: { active: "Recent official event", upcoming: "Announced", past: "Past event", reference: "Official event" },
      ko: { active: "최근 공식 이벤트", upcoming: "공지됨", past: "지난 이벤트", reference: "공식 이벤트" }
    };
    return labels[state.lang]?.[status] || labels["zh-Hant"][status] || t("card.reference");
  }

  function setLiveStatus(message, mode = "") {
    const target = document.getElementById("hub-live-status");
    if (!target) return;
    target.textContent = message;
    target.className = `community-hub-live-status${mode ? ` is-${mode}` : ""}`;
  }

  function setSourceState(mode) {
    const dot = document.getElementById("hub-source-dot");
    if (!dot) return;
    dot.classList.toggle("is-live", mode === "live");
    dot.classList.toggle("is-error", mode === "error");
  }

  function applyStaticCopy() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-hub-key]").forEach((node) => {
      const key = node.getAttribute("data-hub-key");
      if (key) node.textContent = t(key);
    });
    document.querySelectorAll("[data-hub-placeholder]").forEach((node) => {
      const key = node.getAttribute("data-hub-placeholder");
      if (key) node.setAttribute("placeholder", t(key));
    });
    const selector = document.getElementById("community-hub-lang-select");
    if (selector) selector.value = state.lang;
    updateDocumentTitle();
  }

  function updateDocumentTitle() {
    const currentLabel = t(`nav.${state.view}`);
    document.title = `Renaiss Community Hub | ${currentLabel}`;
  }

  function currentRoute(view = state.view) {
    const params = new URLSearchParams(window.location.search);
    params.delete("guide");
    params.delete("article");
    if (view === "guide") params.set("guide", state.guideTopic);
    if (view === "article" && state.articleUrl) params.set("article", state.articleUrl);
    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ""}#${view}`;
  }

  function writeRoute(view, replace = false) {
    const route = currentRoute(view);
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` === route) return;
    const method = replace ? "replaceState" : "pushState";
    history[method]({ hubView: view, guideTopic: state.guideTopic, articleUrl: state.articleUrl }, "", route);
  }

  function setView(nextView, updateHash = true) {
    const view = HUB_VIEWS.has(nextView) ? nextView : "overview";
    const changed = view !== state.view;
    if (state.hasMountedView && !changed) return;
    if (state.hasMountedView && changed && window.scrollY > 0) window.scrollTo({ top: 0, behavior: "auto" });
    state.view = view;
    updateDocumentTitle();
    document.querySelectorAll("[data-hub-panel]").forEach((panel) => {
      const active = panel.getAttribute("data-hub-panel") === view;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
      panel.classList.remove("is-entering");
      if (active && state.hasMountedView && changed) {
        window.requestAnimationFrame(() => panel.classList.add("is-entering"));
      }
    });
    document.querySelectorAll("[data-hub-view]").forEach((button) => {
      const active = button.getAttribute("data-hub-view") === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (updateHash) writeRoute(view);
    state.hasMountedView = true;
  }

  function translationIsPending(feed = state.feed) {
    const i18n = feed?._i18n;
    if (state.lang === "zh-Hant" || !i18n || typeof i18n !== "object") return false;
    return ["building", "pretranslated-partial"].includes(String(i18n.mode || ""))
      && (Number(i18n.pending) > 0 || Number(i18n.fallback) > 0);
  }

  function translationProgress(feed = state.feed) {
    const coverage = Number(feed?._i18n?.coverage);
    return Number.isFinite(coverage) && coverage >= 0 ? `${Math.round(coverage * 100)}%` : "";
  }

  function emptyHtml() {
    if (translationIsPending()) {
      return `<div class="community-hub-empty"><strong>${escapeHtml(t("source.translatingTitle"))}</strong><p>${escapeHtml(t("source.translatingBody"))}</p></div>`;
    }
    return `<div class="community-hub-empty"><strong>${escapeHtml(t("source.unavailable"))}</strong></div>`;
  }

  function clearTranslationRetry() {
    if (state.translationRetryTimer) window.clearTimeout(state.translationRetryTimer);
    state.translationRetryTimer = 0;
  }

  function scheduleTranslationRetry() {
    clearTranslationRetry();
    if (!translationIsPending()) {
      state.translationRetries = 0;
      return;
    }
    if (state.translationRetries >= 10) return;
    state.translationRetries += 1;
    state.translationRetryTimer = window.setTimeout(loadFeed, 12000);
  }

  function cardMediaHtml(card) {
    const cover = safeCoverUrl(card.cover_image);
    if (!cover) return defaultCoverHtml("community-hub-card-media");
    return `<div class="community-hub-card-media"><img src="${escapeHtml(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.outerHTML='${defaultCoverHtml("community-hub-card-media").replace(/"/g, "&quot;")}'" /></div>`;
  }

  function cardHtml(card, options = {}) {
    const source = safeUrl(card.url);
    const title = escapeHtml(card.title || "Renaiss");
    const summary = escapeHtml(card.summary || card.glance || "");
    const status = options.status || temporalStatus(card);
    const statusLabel = options.statusLabel || labelForStatus(status);
    const excerpt = Array.isArray(card.bullets) ? String(card.bullets.find((row) => String(row || "").trim()) || "").trim() : "";
    const account = String(card.account || "source").trim();
    const published = formatDate(card.timeline_date || card.published_at);
    const typeLabel = isOfficial(card) ? t("card.official") : isCommunity(card) ? t("card.community") : String(card.card_type || t("card.reference"));
    const titleHtml = source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noreferrer">${title}</a>` : title;
    const sourceHtml = source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noreferrer">${escapeHtml(t("card.original"))}<iconify-icon icon="lucide:arrow-up-right"></iconify-icon></a>` : "";
    return `<article class="community-hub-content-item">
      ${cardMediaHtml(card)}
      <div class="community-hub-card-body">
        <div class="community-hub-card-meta"><span>@${escapeHtml(account)} · ${escapeHtml(typeLabel)}</span><span class="community-hub-card-status is-${escapeHtml(status)}">${escapeHtml(statusLabel)} · ${escapeHtml(published)}</span></div>
        <h3>${titleHtml}</h3>
        <p class="community-hub-card-summary">${summary}</p>
        <div class="community-hub-card-foot">${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ""}${sourceHtml}</div>
      </div>
    </article>`;
  }

  function featureCardHtml(card) {
    const source = safeUrl(card.url);
    const href = source || "#events";
    const cover = safeCoverUrl(card.cover_image);
    const media = cover
      ? `<div class="community-hub-feature-media"><img src="${escapeHtml(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.outerHTML='${defaultCoverHtml("community-hub-feature-media").replace(/"/g, "&quot;")}'" /></div>`
      : defaultCoverHtml("community-hub-feature-media");
    return `<a class="community-hub-feature-link" href="${escapeHtml(href)}"${source ? ' target="_blank" rel="noreferrer"' : ""}>
      ${media}
      <div><p class="community-hub-feature-meta">${escapeHtml(eventStatusLabel(eventStatus(card)))} · ${escapeHtml(formatDate(card.timeline_date || card.published_at))}</p><h3>${escapeHtml(card.title || "Renaiss")}</h3></div>
    </a>`;
  }

  function signalHtml(card) {
    const source = safeUrl(card.url);
    const href = source || "#media";
    return `<a class="community-hub-signal-link" href="${escapeHtml(href)}"${source ? ' target="_blank" rel="noreferrer"' : ""}>
      <span><strong>${escapeHtml(card.title || "Renaiss")}</strong><small>${escapeHtml(card.summary || card.glance || "")}</small></span><iconify-icon icon="lucide:arrow-up-right"></iconify-icon>
    </a>`;
  }

  function currentCards() {
    return state.feed ? normalizeCards(state.feed) : [];
  }

  function overviewSbtHtml(row) {
    const copy = sbtCopy[state.lang] || sbtCopy["zh-Hant"];
    const source = safeUrl(row.source);
    const href = source || "#sbt";
    return `<a class="community-hub-overview-sbt-link" href="${escapeHtml(href)}"${source ? ' target="_blank" rel="noreferrer"' : ""}>
      <span class="community-hub-overview-sbt-icon"><iconify-icon icon="lucide:badge-check"></iconify-icon></span>
      <span class="community-hub-overview-sbt-copy"><small>${escapeHtml(row.badge || copy.acquisition)}</small><strong>${escapeHtml(row.name)}</strong><em>${escapeHtml(row.requirement)}</em></span>
      <iconify-icon class="community-hub-overview-sbt-arrow" icon="lucide:arrow-up-right"></iconify-icon>
    </a>`;
  }

  function boundedSbtStatus(card) {
    const end = toDate(card.timeline_end_date);
    const start = toDate(card.timeline_date) || toDate(card.published_at);
    if (!start || !end) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (endDay < today) return "ended";
    return startDay > today ? "upcoming" : "active";
  }

  function currentLimitedSbtCampaignRows() {
    return currentCards()
      .filter(isOfficial)
      .filter(isSbt)
      .map((card) => {
        const status = boundedSbtStatus(card);
        const names = [...new Set([...(Array.isArray(card.sbt_names) ? card.sbt_names : []), card.sbt_name]
          .map((name) => String(name || "").trim())
          .filter(Boolean))];
        const acquisition = String(card.sbt_acquisition || "").trim();
        const end = toDate(card.timeline_end_date);
        const source = safeUrl(card.url);
        if (!status || status === "ended" || !names.length || !acquisition || !end || !source) return null;
        return {
          badge: `${eventStatusLabel(status)} · ${formatDate(end)}`,
          name: names.join(" · "),
          requirement: acquisition,
          source,
          status,
          end: end.valueOf()
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.status === b.status ? a.end - b.end : a.status === "active" ? -1 : 1));
  }

  function limitedSbtEmptyHtml() {
    return `<div class="community-hub-empty"><strong>${escapeHtml(t("overview.sbtEmpty"))}</strong></div>`;
  }

  function renderOverview() {
    const cards = currentCards();
    const focusEvents = cards.filter(isEvent).filter((card) => ["active", "upcoming"].includes(eventStatus(card)));
    const events = focusEvents.slice(0, 3);
    const signals = cards.filter((card) => isOfficial(card) || isSbt(card)).slice(0, 5);
    const limitedSbt = currentLimitedSbtCampaignRows();
    const eventTarget = document.getElementById("hub-overview-events");
    const sbtTarget = document.getElementById("hub-overview-sbt");
    const signalTarget = document.getElementById("hub-overview-signals");
    if (eventTarget) eventTarget.innerHTML = events.length ? events.map(featureCardHtml).join("") : emptyHtml();
    if (sbtTarget) sbtTarget.innerHTML = limitedSbt.length ? limitedSbt.slice(0, 3).map(overviewSbtHtml).join("") : limitedSbtEmptyHtml();
    if (signalTarget) signalTarget.innerHTML = signals.length ? signals.map(signalHtml).join("") : emptyHtml();
    const headline = document.getElementById("hub-digest-headline");
    const feedHeadline = String(state.feed?.digest?.headline || "").trim();
    if (headline) headline.textContent = translationIsPending() ? t("source.translatingTitle") : (feedHeadline || t("overview.loadingLead"));
    const updated = document.getElementById("hub-source-updated");
    const summary = document.getElementById("hub-source-summary");
    if (summary) summary.textContent = t("source.live");
    if (updated) updated.textContent = `${t("source.updated")} ${formatUpdate(state.feed?.generated_at)} · ${cards.length} ${t("source.cards")}`;
  }

  function renderFeed() {
    const target = document.getElementById("hub-feed-list");
    if (!target) return;
    const query = state.search.toLowerCase().trim();
    let cards = currentCards().filter((card) => isOfficial(card) || isCommunity(card) || isTaggedRenaiss(card));
    if (state.filters.feed === "official") cards = cards.filter(isOfficial);
    if (state.filters.feed === "community") cards = cards.filter(isCommunity);
    if (state.filters.feed === "tagged") cards = cards.filter(isTaggedRenaiss);
    if (query) cards = cards.filter((card) => [card.title, card.summary, card.account, card.raw_text].join(" ").toLowerCase().includes(query));
    target.innerHTML = cards.length ? cards.slice(0, MAX_ROWS).map(cardHtml).join("") : emptyHtml();
  }

  function renderEvents() {
    const target = document.getElementById("hub-event-list");
    if (!target) return;
    let cards = currentCards().filter(isEvent);
    cards = cards.filter((card) => eventStatus(card) === state.filters.events);
    target.innerHTML = cards.length ? cards.slice(0, MAX_ROWS).map((card) => {
      const status = eventStatus(card);
      return cardHtml(card, { status, statusLabel: eventStatusLabel(status) });
    }).join("") : emptyHtml();
  }

  function currentSbtRows() {
    const catalog = Array.isArray(window.RENAISS_SBT_CATALOG) ? window.RENAISS_SBT_CATALOG : [];
    const requirements = window.BEGINNER_GUIDE_STATIC?.sbtRequirements?.[state.lang]
      || window.BEGINNER_GUIDE_STATIC?.sbtRequirements?.["zh-Hant"]
      || {};
    const iconBase = String(window.RENAISS_SBT_ICON_BASE || "").trim();
    return catalog
      .filter((row) => row && typeof row === "object")
      .map((row) => ({
        name: String(row.name || "").trim(),
        badge: String(row.badge || "").trim(),
        status: String(row.status || "").trim().toLowerCase(),
        requirement: String(requirements[row.name] || row.requirement || "").trim(),
        difficulty: Math.max(0, Math.min(5, Number(row.difficulty) || 0)),
        icons: Array.isArray(row.icons) ? row.icons.map((icon) => `${iconBase}${encodeURIComponent(String(icon || "").trim())}`).filter((icon) => icon !== iconBase) : []
      }))
      .filter((row) => row.name && row.requirement);
  }

  function currentSbtGuide() {
    const guide = window.BEGINNER_GUIDE_STATIC?.guides?.[state.lang]
      || window.BEGINNER_GUIDE_STATIC?.guides?.["zh-Hant"];
    const sections = Array.isArray(guide?.sections) ? guide.sections : [];
    return sections.find((section) => String(section?.type || "") === "sbtChecklist") || null;
  }

  function guideTextHtml(value) {
    return escapeHtml(value).replace(/==([^=]+)==/g, "<strong>$1</strong>");
  }

  function sbtPrimerHtml() {
    const guide = currentSbtGuide();
    if (!guide) return "";
    const primer = Array.isArray(guide.primer) ? guide.primer : [];
    return `<details class="community-hub-sbt-primer-details" open>
      <summary><span><p class="community-hub-section-index">PRIMER</p><strong>${escapeHtml(guide.introTitle || guide.title || "SBT")}</strong><small>${escapeHtml(t("sbt.guideActionLead"))}</small></span><iconify-icon icon="lucide:chevron-down"></iconify-icon></summary>
      <div class="community-hub-sbt-primer-body"><p>${guideTextHtml(guide.text || "")}</p>${primer.length ? `<dl class="community-hub-sbt-primer">${primer.map((item) => `<div><dt>${escapeHtml(item?.[0] || "")}</dt><dd>${guideTextHtml(item?.[1] || "")}</dd></div>`).join("")}</dl>` : ""}</div>
    </details>`;
  }

  function sbtRowHtml(row) {
    const copy = sbtCopy[state.lang] || sbtCopy["zh-Hant"];
    const icons = row.icons.slice(0, 2).map((src) => `<img src="${escapeHtml(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`).join("");
    const difficulty = row.difficulty ? `${escapeHtml(copy.difficulty)} ${row.difficulty}/5` : "";
    return `<article class="community-hub-sbt-item">
      <div class="community-hub-sbt-icons">${icons}</div>
      <div class="community-hub-sbt-main"><p>${escapeHtml(row.badge)}</p><h3>${escapeHtml(row.name)}</h3></div>
      <p class="community-hub-sbt-acquisition"><span>${escapeHtml(copy.acquisition)}</span>${escapeHtml(row.requirement)}</p>
      <div class="community-hub-sbt-foot"><span>${difficulty}</span></div>
    </article>`;
  }

  function staticSbtCatalogHtml() {
    const rows = currentSbtRows().filter((row) => row.status === "available");
    const labels = window.BEGINNER_GUIDE_STATIC?.labels?.[state.lang]
      || window.BEGINNER_GUIDE_STATIC?.labels?.["zh-Hant"]
      || {};
    return `<section class="community-hub-guide-sbt-catalog"><header><p class="community-hub-section-index">CURRENT TASKS</p><h3>${escapeHtml(labels.sbtTitle || t("sbt.acquisitionTitle"))}</h3><p>${escapeHtml(labels.sbtSubtitle || "")}</p></header><div class="community-hub-sbt-catalog-list">${rows.length ? rows.map(sbtRowHtml).join("") : emptyHtml()}</div></section>`;
  }

  function currentSbtAcquisitions() {
    const rows = new Map();
    currentCards().filter(isSbt).forEach((card) => {
      const names = [...new Set([...(Array.isArray(card.sbt_names) ? card.sbt_names : []), card.sbt_name].map((name) => String(name || "").trim()).filter(Boolean))];
      const acquisition = String(card.sbt_acquisition || "").trim();
      const source = safeUrl(card.url);
      if (!names.length || !acquisition || !source) return;
      names.forEach((name) => {
        const key = `${name}\u0000${acquisition}`.toLowerCase();
        const previous = rows.get(key);
        if (!previous || Number(toDate(card.published_at) || 0) > Number(toDate(previous.published_at) || 0)) {
          rows.set(key, { name, acquisition, title: String(card.title || "Renaiss"), source, published_at: card.published_at });
        }
      });
    });
    return [...rows.values()].sort((a, b) => Number(toDate(b.published_at) || 0) - Number(toDate(a.published_at) || 0));
  }

  function sbtAcquisitionHtml(row) {
    return `<article class="community-hub-sbt-acquisition-row"><div><p class="community-hub-section-index">SBT</p><h4>${escapeHtml(row.name)}</h4></div><p>${escapeHtml(row.acquisition)}</p><button type="button" data-hub-open-article="${escapeHtml(row.source)}">${escapeHtml(row.title)}<iconify-icon icon="lucide:arrow-right"></iconify-icon></button></article>`;
  }

  function sbtArticleHtml(card) {
    const source = safeUrl(card.url);
    if (!source) return "";
    const title = escapeHtml(card.title || "Renaiss");
    const summary = escapeHtml(card.summary || card.glance || "");
    const account = String(card.account || "source").trim();
    const published = formatDate(card.timeline_date || card.published_at);
    const typeLabel = isOfficial(card) ? t("card.official") : isCommunity(card) ? t("card.community") : t("card.reference");
    return `<article class="community-hub-content-item community-hub-sbt-article-item">
      ${cardMediaHtml(card)}
      <div class="community-hub-card-body">
        <div class="community-hub-card-meta"><span>@${escapeHtml(account)} · ${escapeHtml(typeLabel)}</span><span class="community-hub-card-status">${escapeHtml(published)}</span></div>
        <h3><button type="button" data-hub-open-article="${escapeHtml(source)}">${title}</button></h3>
        <p class="community-hub-card-summary">${summary}</p>
        <div class="community-hub-card-foot"><button type="button" data-hub-open-article="${escapeHtml(source)}">${escapeHtml(t("nav.article"))}<iconify-icon icon="lucide:arrow-right"></iconify-icon></button><a href="${escapeHtml(source)}" target="_blank" rel="noreferrer">${escapeHtml(t("card.original"))}<iconify-icon icon="lucide:arrow-up-right"></iconify-icon></a></div>
      </div>
    </article>`;
  }

  function renderSbt() {
    const primerTarget = document.getElementById("hub-sbt-primer");
    const acquisitionTarget = document.getElementById("hub-sbt-acquisition-list");
    const articleTarget = document.getElementById("hub-sbt-article-list");
    if (primerTarget) primerTarget.innerHTML = sbtPrimerHtml();
    const acquisitionRows = currentSbtAcquisitions();
    if (acquisitionTarget) acquisitionTarget.innerHTML = acquisitionRows.length ? acquisitionRows.slice(0, MAX_ROWS).map(sbtAcquisitionHtml).join("") : emptyHtml();
    const articles = currentCards().filter(isSbt).filter((card) => safeUrl(card.url));
    if (articleTarget) articleTarget.innerHTML = articles.length ? articles.slice(0, MAX_ROWS).map(sbtArticleHtml).filter(Boolean).join("") : emptyHtml();
  }

  function renderGuide() {
    const target = document.getElementById("hub-guide-root");
    if (!target) return;
    const renderer = window.RENAISS_COMMUNITY_GUIDE;
    if (!renderer?.render) {
      target.innerHTML = emptyHtml();
      return;
    }
    target.innerHTML = renderer.render({
      lang: state.lang,
      topic: state.guideTopic,
      formatInline: guideTextHtml,
      renderSbtCatalog: staticSbtCatalogHtml
    });
  }

  function currentArticle() {
    return currentCards().find((card) => safeUrl(card.url) === state.articleUrl) || null;
  }

  function articleFacts(card) {
    const values = [
      ...(Array.isArray(card.bullets) ? card.bullets : []),
      ...(Array.isArray(card.detail_lines) ? card.detail_lines : []),
      ...(Array.isArray(card.event_facts) ? card.event_facts : [])
    ].map((value) => String(value || "").trim()).filter(Boolean);
    return [...new Set(values)];
  }

  function renderArticle() {
    const target = document.getElementById("hub-article-root");
    if (!target) return;
    const card = currentArticle();
    if (!card) {
      target.innerHTML = `<header class="community-hub-page-head"><button type="button" class="community-hub-back-button" data-hub-back-to-sbt><iconify-icon icon="lucide:arrow-left"></iconify-icon>${escapeHtml(t("article.back"))}</button></header><div class="community-hub-empty"><strong>${escapeHtml(t("article.unavailable"))}</strong></div>`;
      return;
    }
    const source = safeUrl(card.url);
    const facts = articleFacts(card);
    const names = [...new Set([...(Array.isArray(card.sbt_names) ? card.sbt_names : []), card.sbt_name].map((name) => String(name || "").trim()).filter(Boolean))];
    const acquisition = String(card.sbt_acquisition || "").trim();
    const cover = safeCoverUrl(card.cover_image);
    target.innerHTML = `<article class="community-hub-article-detail">
      <header class="community-hub-article-header"><button type="button" class="community-hub-back-button" data-hub-back-to-sbt><iconify-icon icon="lucide:arrow-left"></iconify-icon>${escapeHtml(t("article.back"))}</button><p class="community-hub-section-index">SBT ARTICLE</p><h2>${escapeHtml(card.title || "Renaiss")}</h2><p class="community-hub-article-meta">@${escapeHtml(card.account || "source")} · ${escapeHtml(formatDate(card.timeline_date || card.published_at))}</p></header>
      ${cover ? `<figure class="community-hub-article-media"><img src="${escapeHtml(cover)}" alt="" referrerpolicy="no-referrer" /></figure>` : ""}
      <div class="community-hub-article-body"><p class="community-hub-article-summary">${escapeHtml(card.summary || card.glance || "")}</p>${facts.length ? `<section><p class="community-hub-section-index">${escapeHtml(t("article.details"))}</p><ul>${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul></section>` : ""}${names.length || acquisition ? `<section><p class="community-hub-section-index">${escapeHtml(t("article.sbt"))}</p>${names.length ? `<h3>${names.map(escapeHtml).join(" · ")}</h3>` : ""}${acquisition ? `<p>${escapeHtml(acquisition)}</p>` : ""}</section>` : ""}<footer><a class="community-hub-article-source" href="${escapeHtml(source)}" target="_blank" rel="noreferrer">${escapeHtml(t("article.original"))}<iconify-icon icon="lucide:arrow-up-right"></iconify-icon></a></footer></div>
    </article>`;
  }

  function openGuide(topic) {
    const validTopic = guideTopicIds().includes(topic) ? topic : String(window.RENAISS_COMMUNITY_GUIDE?.defaultTopic || "start");
    state.guideTopic = validTopic;
    state.articleUrl = "";
    setView("guide", false);
    renderGuide();
    writeRoute("guide");
  }

  function openArticle(url) {
    const source = safeUrl(url);
    if (!source) return;
    state.articleUrl = source;
    setView("article", false);
    renderArticle();
    writeRoute("article");
  }

  function applyLocationRoute() {
    state.guideTopic = readGuideTopic();
    state.articleUrl = readArticleUrl();
    setView(readInitialView(), false);
    renderGuide();
    renderArticle();
  }

  function renderMedia() {
    const target = document.getElementById("hub-media-list");
    if (!target) return;
    let cards = currentCards().filter(isMedia);
    if (state.filters.media === "official") cards = cards.filter(isOfficial);
    if (state.filters.media === "market") cards = cards.filter((card) => card.topics.includes("collectibles") || card.topics.includes("pokemon") || ["market", "trend", "report"].includes(String(card.card_type || "").toLowerCase()));
    target.innerHTML = cards.length ? cards.slice(0, MAX_ROWS).map(cardHtml).join("") : emptyHtml();
  }

  function renderRecords() {
    const winnersTarget = document.getElementById("hub-winners-state");
    const rankingTarget = document.getElementById("hub-ranking-state");
    const metrics = state.feed?.community_metrics;
    const resultCards = currentCards().filter(isVerifiedResult);
    const resultsCopy = resultCopy[state.lang] || resultCopy["zh-Hant"];
    if (winnersTarget) {
      winnersTarget.innerHTML = resultCards.length
        ? `<div class="community-hub-record-result-intro"><strong>${escapeHtml(resultsCopy.title)}</strong><p>${escapeHtml(resultsCopy.lead)}</p></div><div class="community-hub-record-result-list">${resultCards.slice(0, MAX_ROWS).map((card) => cardHtml(card, { status: "past", statusLabel: resultsCopy.status })).join("")}</div>`
        : `<strong>${escapeHtml(t("source.winnerMissingTitle"))}</strong><p>${escapeHtml(t("source.winnerMissingBody"))}</p>`;
    }
    if (!rankingTarget) return;
    const accountRows = metrics && metrics.accounts && typeof metrics.accounts === "object"
      ? Object.values(metrics.accounts).filter((account) => account && typeof account === "object" && Number.isFinite(Number(account.score)))
      : [];
    if (!accountRows.length) {
      rankingTarget.innerHTML = `<strong>${escapeHtml(t("source.rankMissingTitle"))}</strong><p>${escapeHtml(t("source.rankMissingBody"))}</p>`;
      return;
    }
    const formatter = new Intl.NumberFormat(state.lang === "zh-Hans" ? "zh-CN" : state.lang === "ko" ? "ko-KR" : state.lang === "en" ? "en-US" : "zh-TW");
    const sortedRows = accountRows.sort((a, b) => Number(b.score) - Number(a.score) || String(a.account || "").localeCompare(String(b.account || "")));
    const metricsWindow = Number(metrics.window_days) > 0 ? `${formatter.format(Number(metrics.window_days))} ${state.lang === "en" ? "days" : state.lang === "ko" ? "일" : "天"}` : "--";
    const scoreBasis = Array.isArray(metrics.score_basis) && metrics.score_basis.length ? metrics.score_basis.join(" + ") : "--";
    const rowsHtml = sortedRows.map((account, index) => {
      const name = String(account.account || "unknown").replace(/^@+/, "");
      return `<li class="community-hub-ranking-row">
        <span class="community-hub-ranking-position">${String(index + 1).padStart(2, "0")}</span>
        <div class="community-hub-ranking-account"><strong>@${escapeHtml(name)}</strong><small>${escapeHtml(t("source.metricsPosts"))} ${formatter.format(Number(account.posts) || 0)} · ${escapeHtml(t("source.metricsLikes"))} ${formatter.format(Number(account.likes) || 0)} · ${escapeHtml(t("source.metricsReplies"))} ${formatter.format(Number(account.replies) || 0)}</small></div>
        <div class="community-hub-ranking-score"><strong>${formatter.format(Number(account.score) || 0)}</strong><small>${escapeHtml(t("source.metricsScore"))}</small></div>
      </li>`;
    }).join("");
    rankingTarget.innerHTML = `<div class="community-hub-ranking-intro"><strong>${escapeHtml(t("source.metricsTitle"))}</strong><p>${escapeHtml(t("source.metricsBody"))}</p><div><span>${escapeHtml(t("source.metricsWindow"))} ${escapeHtml(metricsWindow)}</span><span>${escapeHtml(t("source.metricsBasis"))} ${escapeHtml(scoreBasis)}</span><span>${escapeHtml(t("source.updated"))} ${escapeHtml(formatUpdate(metrics.updated_at))}</span></div></div><ol class="community-hub-ranking-list">${rowsHtml}</ol>`;
  }

  function renderAll() {
    renderOverview();
    renderFeed();
    renderEvents();
    renderSbt();
    renderGuide();
    renderArticle();
    renderMedia();
    renderRecords();
  }

  async function loadFeed() {
    if (state.controller) state.controller.abort();
    state.controller = new AbortController();
    state.loading = true;
    setLiveStatus(t("source.loading"), "loading");
    setSourceState("");
    document.querySelectorAll("[data-hub-refresh]").forEach((button) => { button.disabled = true; });
    let timeoutId = 0;
    try {
      timeoutId = window.setTimeout(() => state.controller.abort(), 45000);
      const response = await fetch(`${API_BASE}/api/intel/feed?lang=${encodeURIComponent(state.lang)}`, { cache: "no-store", signal: state.controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload?.feed || !Array.isArray(payload.feed.cards)) throw new Error(payload?.error || `HTTP ${response.status}`);
      state.feed = payload.feed;
      const translationSuffix = translationIsPending(payload.feed)
        ? ` · ${t("source.translating")}${translationProgress(payload.feed) ? ` ${translationProgress(payload.feed)}` : ""}`
        : "";
      setLiveStatus(`${t("source.live")} · ${normalizeCards(payload.feed).length} ${t("source.cards")}${translationSuffix}`, translationIsPending(payload.feed) ? "loading" : "");
      setSourceState("live");
      renderAll();
      scheduleTranslationRetry();
    } catch (error) {
      clearTranslationRetry();
      state.feed = null;
      const message = String(error?.name === "AbortError" ? "timeout" : error?.message || "request_failed");
      setLiveStatus(`${t("source.error")} ${message}`, "error");
      setSourceState("error");
      renderAll();
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      state.loading = false;
      document.querySelectorAll("[data-hub-refresh]").forEach((button) => { button.disabled = false; });
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-hub-view]").forEach((button) => {
      button.addEventListener("click", () => setView(String(button.getAttribute("data-hub-view") || "overview")));
    });
    document.querySelectorAll("[data-hub-open-view]").forEach((button) => {
      button.addEventListener("click", () => setView(String(button.getAttribute("data-hub-open-view") || "overview")));
    });
    document.querySelectorAll("[data-hub-refresh]").forEach((button) => button.addEventListener("click", loadFeed));
    document.addEventListener("click", (event) => {
      const guideButton = event.target.closest("[data-hub-open-guide], [data-hub-guide-topic]");
      if (guideButton) {
        event.preventDefault();
        openGuide(String(guideButton.getAttribute("data-hub-open-guide") || guideButton.getAttribute("data-hub-guide-topic") || ""));
        return;
      }
      const articleButton = event.target.closest("[data-hub-open-article]");
      if (articleButton) {
        event.preventDefault();
        openArticle(String(articleButton.getAttribute("data-hub-open-article") || ""));
        return;
      }
      if (event.target.closest("[data-hub-back-to-sbt]")) {
        event.preventDefault();
        setView("sbt");
      }
    });
    document.querySelectorAll("[data-hub-filter-group]").forEach((group) => {
      group.addEventListener("click", (event) => {
        const button = event.target.closest("[data-hub-filter]");
        if (!button) return;
        const name = String(group.getAttribute("data-hub-filter-group") || "");
        const value = String(button.getAttribute("data-hub-filter") || "");
        if (!Object.prototype.hasOwnProperty.call(state.filters, name) || !value) return;
        state.filters[name] = value;
        group.querySelectorAll("[data-hub-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
        if (name === "feed") renderFeed();
        if (name === "events") renderEvents();
        if (name === "media") renderMedia();
      });
    });
    const search = document.getElementById("hub-feed-search");
    if (search) search.addEventListener("input", () => { state.search = search.value; renderFeed(); });
    const selector = document.getElementById("community-hub-lang-select");
    if (selector) selector.addEventListener("change", () => {
      state.lang = normalizeLanguage(selector.value);
      state.translationRetries = 0;
      clearTranslationRetry();
      try { localStorage.setItem(LANGUAGE_STORAGE_KEY, state.lang); } catch (_error) {}
      applyStaticCopy();
      renderAll();
      loadFeed();
    });
    window.addEventListener("hashchange", applyLocationRoute);
    window.addEventListener("popstate", applyLocationRoute);
  }

  applyStaticCopy();
  bindEvents();
  applyLocationRoute();
  document.documentElement.classList.add("community-hub-ui-ready");
  loadFeed();
})();
