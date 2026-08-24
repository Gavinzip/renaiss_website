import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { text } from "@/lib/copy";
import type { Language, OfficialOverview } from "@/types";

interface OfficialSummaryDialogProps {
  lang: Language;
  onClose: () => void;
  open: boolean;
  overview?: OfficialOverview;
}

export function OfficialSummaryDialog({ lang, onClose, open, overview }: OfficialSummaryDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;
  const bullets = overview?.bullets?.filter(Boolean).slice(0, 4) ?? [];
  return <div className="community-hub-summary-dialog" role="dialog" aria-modal="true" aria-labelledby="official-summary-dialog-title" onMouseDown={(event) => {
    if (event.currentTarget === event.target) onClose();
  }}>
    <article className="community-hub-summary-dialog-panel">
      <header>
        <div>
          <span>{text(lang, "official.summaryEyebrow")}</span>
          <h2 id="official-summary-dialog-title">{text(lang, "official.summaryTitle")}</h2>
        </div>
        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={text(lang, "official.summaryClose")}><Icon name="x" /></button>
      </header>
      <div className="community-hub-summary-dialog-body">
        {overview?.title || overview?.summary || bullets.length ? <>
          <h3>{overview?.title || text(lang, "official.summaryTitle")}</h3>
          {overview?.summary ? <p>{overview.summary}</p> : null}
          {bullets.length ? <ol>{bullets.map((bullet, index) => <li key={`${index}-${bullet}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{bullet}</p></li>)}</ol> : null}
        </> : <p className="community-hub-summary-empty">{text(lang, "official.summaryUnavailable")}</p>}
      </div>
    </article>
  </div>;
}
