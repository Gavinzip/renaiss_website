import { useState } from "react";
import { Icon } from "@/components/Icon";
import { CardAdminEditor } from "@/components/admin/CardAdminEditor";
import { useAdminTools } from "@/components/admin/AdminToolsContext";
import { updateCardSelection } from "@/lib/admin";
import type { FeedCard } from "@/types";

export function InlineCardAdmin({ card, sbtFocus = false }: { card: FeedCard; sbtFocus?: boolean }) {
  const { enabled, onChanged } = useAdminTools();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  if (!enabled || !card.id) return null;
  const action = async (name: "bottom" | "exclude" | "include" | "pin" | "unbottom" | "unpin") => {
    if (name === "exclude" && !window.confirm("將這篇貼文從公開內容隱藏？之後仍可在待確認佇列重新啟用。")) return;
    setBusy(name);
    try { await updateCardSelection(String(card.id), name, name === "exclude" ? "管理員在卡片上隱藏" : ""); onChanged(); }
    finally { setBusy(""); }
  };
  return <div className="community-hub-inline-admin" onClick={(event) => event.stopPropagation()}>
    <div className="community-hub-inline-admin-bar">
      <span><Icon name="shield-check" />管理員模式</span>
      <button type="button" onClick={() => setOpen((value) => !value)}><Icon name="pencil-line" />{sbtFocus ? "管理 SBT" : "分類與日期"}</button>
      <button type="button" onClick={() => void action(card.manual_pin ? "unpin" : "pin")} disabled={Boolean(busy)}><Icon name="pin" />{card.manual_pin ? "取消置頂" : "置頂"}</button>
      <button type="button" onClick={() => void action(card.manual_bottom ? "unbottom" : "bottom")} disabled={Boolean(busy)}><Icon name="arrow-down-to-line" />{card.manual_bottom ? "取消置底" : "置底"}</button>
      <button type="button" className="is-danger" onClick={() => void action("exclude")} disabled={Boolean(busy)}><Icon name="eye-off" />隱藏</button>
    </div>
    {open ? <CardAdminEditor card={card} onChanged={onChanged} onClose={() => setOpen(false)} sbtFocus={sbtFocus} /> : null}
  </div>;
}
