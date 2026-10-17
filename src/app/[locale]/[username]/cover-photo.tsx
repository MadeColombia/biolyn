"use client";

import { useEffect, useRef } from "react";
import { coverScroll } from "@/lib/cover-scroll";
import { COVER_FADE } from "@/lib/themes";

// Big photo across the top. It turns see-through toward the bottom, so
// it melts into the theme's background, gradients included. As the
// visitor scrolls, it fades away and drifts up behind the content.
//
// Browsers that support scroll-driven animations run the fade in CSS
// (.cover-scroll in globals.css). The browser then moves the photo in
// step with the scroll itself, without waiting for this script, which
// is what keeps it smooth on phones. Older browsers use the script.
export function CoverPhoto({ src, alt }: { src: string; alt: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = outer.current;
    const el = photo.current;
    if (!box || !el || CSS.supports("animation-timeline: view()")) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      // The outer box never moves, so it shows the photo's real place
      // in the page.
      const { top, height } = box.getBoundingClientRect();
      const { opacity, shift } = coverScroll(top, height, motion.matches);
      el.style.opacity = String(opacity);
      el.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : "";
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
    <div ref={outer} className="cover-scroll w-full">
      <div ref={photo} className="will-change-[opacity,transform]">
        {/* The fade sits on the picture itself, so the moving layer
            never has to be redrawn while scrolling. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="aspect-4/5 w-full object-cover [mask-image:var(--fade)]"
          style={{ "--fade": COVER_FADE } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
