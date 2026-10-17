"use client";

import { Children, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// Which ends of the row are showing.
function measure(el: HTMLElement) {
  return {
    start: el.scrollLeft < 8,
    end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8,
  };
}

const arrow =
  "absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white pointer-fine:flex";

/**
 * A row of link cards people swipe. It runs to the edges of the page so
 * the next card peeks in. Computers with a mouse also get arrow buttons,
 * shown only when there is more to see on that side.
 */
export function LinkCarousel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("profile");
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  // Measure again when the row changes size, like after the first
  // paint, when a few cards may already fit.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setEdges(measure(el)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function step(direction: 1 | -1) {
    const el = track.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    el.scrollBy({ left: direction * (card.offsetWidth + 12) });
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="relative -mx-6 md:-mx-10"
    >
      <ul
        ref={track}
        onScroll={(e) => setEdges(measure(e.currentTarget))}
        className="flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] motion-safe:scroll-smooth md:scroll-px-10 md:px-10 [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (card) => (
          <li className="w-[70%] shrink-0 snap-start sm:w-[45%]">{card}</li>
        ))}
      </ul>
      {!edges.start && (
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={t("previousLinks")}
          className={`${arrow} left-2 md:left-3`}
        >
          <Chevron flip />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={t("nextLinks")}
          className={`${arrow} right-2 md:right-3`}
        >
          <Chevron />
        </button>
      )}
    </div>
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
      className={flip ? "rotate-180" : undefined}
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
