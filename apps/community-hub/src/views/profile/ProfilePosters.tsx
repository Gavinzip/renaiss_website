import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { assets } from "@/data/legacy";
import type { TcgProfileData, TcgProfilePosterKind } from "@/lib/profile";
import type { Language } from "@/types";

export type ProfilePosterKind = TcgProfilePosterKind;

interface ProfilePosterProps {
  kind: ProfilePosterKind;
  lang: Language;
  profile: TcgProfileData;
}

const POSTER_LABELS: Record<Language, Record<ProfilePosterKind, string>> = {
  "zh-Hant": { collection: "收藏 Profile", history: "Collection History", extremes: "Heaven and Hell" },
  "zh-Hans": { collection: "收藏 Profile", history: "Collection History", extremes: "Heaven and Hell" },
  en: { collection: "Collection Profile", history: "Collection History", extremes: "Heaven and Hell" },
  ko: { collection: "컬렉션 Profile", history: "Collection History", extremes: "Heaven and Hell" },
};

export function profilePosterLabel(lang: Language, kind: ProfilePosterKind): string {
  return POSTER_LABELS[lang][kind];
}

function instrumentPosterDocument(document: string, kind: ProfilePosterKind, logo: string): string {
  const readinessScript = `<script>
    (() => {
      const announce = async () => {
        const images = Array.from(document.images);
        await Promise.all(images.map((image) => image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            })));
        if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
        requestAnimationFrame(() => requestAnimationFrame(() => {
          parent.postMessage({ type: 'tcg-profile-poster-ready', kind: '${kind}' }, '*');
        }));
      };
      if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', announce, { once: true });
      else announce();
    })();
  <\/script>`;
  const withLogo = document
    .replaceAll('src="logo.png"', `src="${logo}"`)
    .replaceAll("src='logo.png'", `src='${logo}'`);
  return withLogo.includes("</body>") ? withLogo.replace("</body>", `${readinessScript}</body>`) : `${withLogo}${readinessScript}`;
}

function CanonicalPosterFrame({ document, height, kind, label, width }: {
  document: string;
  height: number;
  kind: ProfilePosterKind;
  label: string;
  width: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const sourceDocument = useMemo(() => instrumentPosterDocument(document, kind, assets.renaissLogo), [document, kind]);

  useEffect(() => {
    setReady(false);
  }, [sourceDocument]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => setScale(Math.min(1, viewport.clientWidth / width));
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [width]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "tcg-profile-poster-ready" && event.data.kind === kind) setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [kind]);

  const style = {
    "--tcg-poster-height": `${height}px`,
    "--tcg-poster-scale": scale,
    "--tcg-poster-width": `${width}px`,
    aspectRatio: `${width} / ${height}`,
  } as CSSProperties;

  return <article className="tcg-canonical-poster" data-poster-kind={kind} data-poster-source="tcg-pro-canonical-html" aria-label={label}>
    <div className="tcg-canonical-poster-viewport" ref={viewportRef} style={style}>
      <iframe
        className="tcg-canonical-poster-frame"
        ref={frameRef}
        sandbox="allow-scripts"
        srcDoc={sourceDocument}
        title={label}
      />
      {!ready ? <span className="tcg-canonical-poster-loading">Loading original TCG Pro poster…</span> : null}
    </div>
  </article>;
}

export function ProfilePoster({ kind, lang, profile }: ProfilePosterProps) {
  const document = profile.posters.documents[kind];
  if (!document) {
    return <p className="tcg-canonical-poster-error" role="alert">The original TCG Pro poster is unavailable for this wallet.</p>;
  }
  return <CanonicalPosterFrame
    document={document}
    height={profile.posters.height}
    kind={kind}
    label={profilePosterLabel(lang, kind)}
    width={profile.posters.width}
  />;
}
