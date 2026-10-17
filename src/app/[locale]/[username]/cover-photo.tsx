"use client";

import { useEffect, useRef } from "react";
import { coverScroll } from "@/lib/cover-scroll";
import { COVER_FADE } from "@/lib/themes";

// Big photo across the top. It turns see-through toward the bottom, so
// it melts into the theme's background, gradients included. As the
// visitor scrolls, it fades away and drifts up behind the content.
export function CoverPhoto({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      // The shift is undone first so the box reflects the photo's real
      // place in the page.
      const shift = Number(el.dataset.shift ?? 0);
      const { opacity, shift: next } = coverScroll(
        box.top - shift,
        box.height,
        motion.matches,
      );
      el.style.opacity = String(opacity);
      el.style.transform = next ? `translate3d(0, ${next}px, 0)` : "";
      el.dataset.shift = String(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="w-full will-change-[opacity,transform] [mask-image:var(--fade)]"
      style={{ "--fade": COVER_FADE } as React.CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="aspect-4/5 w-full object-cover" />
    </div>
  );
}
