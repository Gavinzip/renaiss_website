import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ProductAssignmentPicker } from "@/components/admin/ProductAssignmentPicker";
import { RecordResultEditor } from "@/components/admin/RecordResultEditor";
import { SbtEntriesEditor } from "@/components/admin/SbtEntriesEditor";
import {
  CARD_TYPES,
  ROUTING_TOPICS,
  cardDraft,
  refreshCardContent,
  saveCardEditorial,
  type CardEditorialDraft,
} from "@/lib/admin";
import { formatUpdate } from "@/lib/feed";
import type { FeedCard } from "@/types";

const typeLabels: Record<string, string> = { announcement: "公告", event: "活動", guide: "教學／指南", insight: "一般資訊", market: "市場", product_progress: "產品進度", report: "報告" };
const routingTopicLabels: Record<string, string> = { collectibles: "收藏／TCG" };
const regions = [["unknown", "待確認"], ["global", "全球／線上"], ["tw", "台灣"], ["kr", "韓國"], ["my", "馬來西亞"], ["vn", "越南"], ["th", "泰國"], ["multi_region", "跨地區"]] as const;
const plans = [["needs_review", "待確認"], ["upcoming", "即將推出"], ["in_progress", "進行中"], ["completed", "已完成"], ["cancelled", "已取消"], ["not_plan", "非產品規劃"]] as const;

function RoutingTopicPicker({ draft, onChange }: { draft: CardEditorialDraft; onChange: (next: CardEditorialDraft) => void }) {
  const toggle = (topic: string) => {
    const selected = new Set(draft.routingTopics);
    if (selected.has(topic)) selected.delete(topic); else selected.add(topic);
    onChange({ ...draft, routingTopics: [...selected] });
  };
  return <div className="community-hub-admin-topics">{ROUTING_TOPICS.map((topic) => <label key={topic} className={draft.routingTopics.includes(topic) ? "is-selected" : ""}><input type="checkbox" checked={draft.routingTopics.includes(topic)} onChange={() => toggle(topic)} /><span>{routingTopicLabels[topic] ?? topic}</span></label>)}</div>;
}

export function CardAdminEditor({ card, onChanged, onClose, sbtFocus = false }: { card: FeedCard; onChanged: () => void; onClose: () => void; sbtFocus?: boolean }) {
  const [draft, setDraft] = useState<CardEditorialDraft>(() => cardDraft(card));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const availableCardTypes = card.source_role === "official" ? CARD_TYPES : CARD_TYPES.filter((type) => type !== "product_progress");
  useEffect(() => setDraft(cardDraft(card)), [card]);

  const save = async () => {
    setSaving(true);
    setMessage("正在儲存…");
    try {
      const changed = await saveCardEditorial(card, draft);
      setMessage(changed ? "已儲存並建立版本紀錄。" : "沒有需要儲存的變更。");
      if (changed) onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally { setSaving(false); }
  };
  const rerun = async () => {
    if (!window.confirm("重新分析這篇貼文？已儲存的人工欄位會保留。")) return;
    setRefreshing(true);
    setMessage("正在重新分類…");
    try { await refreshCardContent(String(card.id || "")); setMessage("重新分類完成。"); onChanged(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "重新分類失敗"); }
    finally { setRefreshing(false); }
  };

  return <div className={`community-hub-admin-editor is-inline${sbtFocus ? " is-sbt-focus" : ""}`} onClick={(event) => event.stopPropagation()}>
    <div className="community-hub-admin-editor-head"><div><span>來源發文時間</span><strong>{formatUpdate(card.published_at, "zh-Hant")}</strong></div><button type="button" className="community-hub-icon-button" onClick={onClose} aria-label="關閉編輯"><Icon name="x" /></button></div>
    {!sbtFocus ? <>
      <div className="community-hub-admin-form-grid">
        <label><span>卡片類型</span><select value={draft.cardType} onChange={(event) => setDraft({ ...draft, cardType: event.target.value })}>{availableCardTypes.map((type) => <option key={type} value={type}>{typeLabels[type] ?? type}</option>)}</select></label>
        <label><span>內容開始日</span><input type="date" value={draft.timelineDate} onChange={(event) => setDraft({ ...draft, timelineDate: event.target.value })} /></label>
        <label><span>內容結束日</span><input type="date" value={draft.timelineEndDate} onChange={(event) => setDraft({ ...draft, timelineEndDate: event.target.value })} /></label>
        {draft.cardType === "event" ? <label><span>活動地區</span><select value={draft.eventRegion} onChange={(event) => setDraft({ ...draft, eventRegion: event.target.value })}>{regions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
        {draft.cardType === "product_progress" ? <label><span>產品進度狀態</span><select value={draft.planStatus} onChange={(event) => setDraft({ ...draft, planStatus: event.target.value as CardEditorialDraft["planStatus"] })}>{plans.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
      </div>
      <fieldset><legend>內部導頁主題（不顯示於卡片）</legend><RoutingTopicPicker draft={draft} onChange={setDraft} /></fieldset>
      <ProductAssignmentPicker value={draft.productIds} onChange={(productIds) => setDraft({ ...draft, productIds })} />
    </> : <div className="community-hub-admin-form-grid"><label><span>內容開始日</span><input type="date" value={draft.timelineDate} onChange={(event) => setDraft({ ...draft, timelineDate: event.target.value })} /></label><label><span>內容結束日</span><input type="date" value={draft.timelineEndDate} onChange={(event) => setDraft({ ...draft, timelineEndDate: event.target.value })} /></label></div>}
    <SbtEntriesEditor entries={draft.sbtEntries} onChange={(sbtEntries) => setDraft({ ...draft, sbtEntries })} />
    {!sbtFocus ? <>
      <RecordResultEditor value={draft.recordResult} onChange={(recordResult) => setDraft({ ...draft, recordResult })} />
      <div className="community-hub-admin-form-grid is-wide"><label><span>修正原因（會成為後續分類依據）</span><textarea rows={3} value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="例如：這是台灣實體活動，不是一般公告。" /></label></div>
    </> : null}
    <div className="community-hub-admin-editor-actions"><span role="status">{message}</span>{!sbtFocus ? <button type="button" onClick={rerun} disabled={refreshing || saving}><Icon name="scan-search" />{refreshing ? "分類中" : "重新分類"}</button> : null}<button type="button" className="is-primary" onClick={save} disabled={saving || refreshing}><Icon name="save" />{saving ? "儲存中" : "儲存"}</button></div>
  </div>;
}
