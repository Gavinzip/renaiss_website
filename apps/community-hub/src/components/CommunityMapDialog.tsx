import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { text } from "@/lib/copy";
import type { Language } from "@/types";

interface CommunityMapDialogProps {
  lang: Language;
  onClose: () => void;
  open: boolean;
}

export function CommunityMapDialog({ lang, onClose, open }: CommunityMapDialogProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;
  return <div className="community-hub-map-dialog" role="dialog" aria-modal="true" aria-labelledby="community-map-dialog-title" onMouseDown={(event) => {
    if (event.currentTarget === event.target) onClose();
  }}>
    <div className="community-hub-map-dialog-panel">
      <header>
        <div>
          <span>COMMUNITY PULSE</span>
          <h2 id="community-map-dialog-title">{text(lang, "community.mapTitle")}</h2>
        </div>
        <div>
          <a href="../community_map.html" target="_blank" rel="noreferrer">{text(lang, "community.mapOpenNew")}<Icon name="arrow-up-right" /></a>
          <button type="button" onClick={onClose} aria-label={text(lang, "community.mapClose")}><Icon name="x" /></button>
        </div>
      </header>
      <iframe src="../community_map.html?embed=1" title={text(lang, "community.mapTitle")} />
    </div>
  </div>;
}
