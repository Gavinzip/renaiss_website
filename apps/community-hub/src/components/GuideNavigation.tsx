import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

interface GuideChapter {
  id: string;
  title: string;
  subtitle: string;
}

interface GuideNavigationProps {
  chapters: GuideChapter[];
  label: string;
  onChange: (id: string) => void;
  selected: string;
}

export function GuideNavigation({ chapters, label, onChange, selected }: GuideNavigationProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const previousSelection = useRef<string | null>(null);
  const chapterKey = chapters.map((chapter) => `${chapter.id}:${chapter.title}`).join("|");

  useLayoutEffect(() => {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;
    const resize = () => {
      positionActiveChapter(bar, pill, false);
      revealActiveChapter(bar, false, true);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(bar);
    bar.querySelectorAll("button").forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [chapterKey]);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;
    const animate = previousSelection.current !== null && previousSelection.current !== selected;
    positionActiveChapter(bar, pill, animate);
    previousSelection.current = selected;
    revealActiveChapter(bar, animate);
  }, [selected, chapterKey]);

  const selectWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % chapters.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + chapters.length) % chapters.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = chapters.length - 1;
    else return;
    event.preventDefault();
    barRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus({ preventScroll: true });
    onChange(chapters[next].id);
  };

  return <nav className="community-hub-chapter-navigation" aria-label={label}>
    <div ref={barRef} className="community-hub-chapter-tabs t-tabs" role="tablist" aria-label={label}>
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {chapters.map((chapter, index) => <button
        type="button"
        key={chapter.id}
        id={`guide-chapter-${chapter.id}`}
        className="t-tab"
        role="tab"
        aria-selected={chapter.id === selected}
        aria-controls="community-hub-guide-panel"
        tabIndex={chapter.id === selected ? 0 : -1}
        onClick={() => onChange(chapter.id)}
        onKeyDown={(event) => selectWithKeyboard(event, index)}
        title={chapter.subtitle}
      >
        <span className="community-hub-chapter-number">{String(index).padStart(2, "0")}</span>
        <strong>{chapter.title}</strong>
      </button>)}
    </div>
  </nav>;
}

function revealActiveChapter(bar: HTMLDivElement, animate: boolean, onlyIfHidden = false) {
  const active = bar.querySelector<HTMLButtonElement>('[aria-selected="true"]');
  if (!active || !bar.clientWidth) return;
  if (onlyIfHidden && active.offsetLeft >= bar.scrollLeft && active.offsetLeft + active.offsetWidth <= bar.scrollLeft + bar.clientWidth) return;
  const maximum = Math.max(0, bar.scrollWidth - bar.clientWidth);
  const left = Math.min(maximum, Math.max(0, active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2));
  bar.scrollTo({ left, behavior: animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant" });
}

function positionActiveChapter(bar: HTMLDivElement, pill: HTMLSpanElement, animate: boolean) {
  const active = bar.querySelector<HTMLButtonElement>('[aria-selected="true"]');
  if (!active || !bar.clientWidth) return;
  const transition = pill.style.transition;
  if (!animate) pill.style.transition = "none";
  pill.style.transform = `translateX(${active.offsetLeft}px)`;
  pill.style.width = `${active.offsetWidth}px`;
  if (!animate) {
    // Initial paint and resizing must place the highlight without sliding from zero.
    void pill.offsetWidth;
    pill.style.transition = transition;
  }
}
