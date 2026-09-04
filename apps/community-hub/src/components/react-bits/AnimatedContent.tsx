import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface AnimatedContentProps extends HTMLAttributes<HTMLDivElement> {
  animateOpacity?: boolean;
  children: ReactNode;
  container?: Element | string | null;
  delay?: number;
  direction?: "vertical" | "horizontal";
  distance?: number;
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  onComplete?: () => void;
  reverse?: boolean;
  scale?: number;
  threshold?: number;
}

/**
 * React Bits AnimatedContent, adapted to the Community Hub's window scroller
 * and reduced-motion preferences.
 */
export function AnimatedContent({
  animateOpacity = true,
  children,
  className = "",
  container,
  delay = 0,
  direction = "vertical",
  distance = 18,
  duration = 0.62,
  ease = "power3.out",
  initialOpacity = 0.06,
  onComplete,
  reverse = false,
  scale = 0.995,
  style,
  threshold = 0.08,
  ...props
}: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(element, { clearProps: "all", visibility: "visible" });
      onComplete?.();
      return;
    }

    let scrollerTarget = container;
    if (typeof scrollerTarget === "string") scrollerTarget = document.querySelector(scrollerTarget);

    const axis = direction === "horizontal" ? "x" : "y";
    const offset = reverse ? -distance : distance;
    const startPercentage = (1 - threshold) * 100;

    gsap.set(element, {
      [axis]: offset,
      opacity: animateOpacity ? initialOpacity : 1,
      scale,
    });

    const timeline = gsap.timeline({ delay, paused: true, onComplete });
    timeline.to(element, {
      [axis]: 0,
      duration,
      ease,
      opacity: 1,
      scale: 1,
    });

    const trigger = ScrollTrigger.create({
      onEnter: () => timeline.play(),
      once: true,
      scroller: scrollerTarget || window,
      start: `top ${startPercentage}%`,
      trigger: element,
    });

    return () => {
      trigger.kill();
      timeline.kill();
    };
  }, [animateOpacity, container, delay, direction, distance, duration, ease, initialOpacity, onComplete, reverse, scale, threshold]);

  return <div ref={ref} className={className} style={style} {...props}>{children}</div>;
}
