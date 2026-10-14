"use client";

import { useRef, useState } from "react";
import type { GalleryLayout } from "@/lib/gallery";
import type { PublicPhoto } from "@/lib/profiles";

// The owner's photos as a swipeable carousel or a grid. Colors come from
// the page's text color (bg-current), so it fits every theme. The arrow
// buttons sit on the photo itself, so they use a dark see-through circle.
export function Gallery({
  title,
  layout,
  photos,
}: {
  title: string;
  layout: GalleryLayout;
  photos: PublicPhoto[];
}) {
  if (photos.length === 0) return null;
  return layout === "grid" ? (
    <PhotoGrid title={title} photos={photos} />
  ) : (
    <Carousel title={title} photos={photos} />
  );
}

const circle =
  "absolute flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const arrow = `${circle} top-1/2 -translate-y-1/2`;

function Carousel({ title, photos }: { title: string; photos: PublicPhoto[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const many = photos.length > 1;

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, to));
    el.scrollTo({ left: next * el.clientWidth });
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={title}
      className="flex w-full flex-col gap-3"
    >
      <div className="relative">
        <ul
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-xl [scrollbar-width:none] motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <li
              key={photo.id}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${photos.length}`}
              className="w-full shrink-0 snap-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                className="aspect-[4/5] w-full object-cover"
              />
            </li>
          ))}
        </ul>
        {many && index > 0 && (
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous photo"
            className={`${arrow} left-3`}
          >
            <Chevron flip />
          </button>
        )}
        {many && index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next photo"
            className={`${arrow} right-3`}
          >
            <Chevron />
          </button>
        )}
      </div>
      {many && (
        <div className="flex justify-center gap-1.5">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className="flex size-6 items-center justify-center"
            >
              <span
                className={`block size-2 rounded-full bg-current transition ${
                  i === index ? "opacity-100" : "opacity-30"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function PhotoGrid({ title, photos }: { title: string; photos: PublicPhoto[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<PublicPhoto | null>(null);
  const cols =
    photos.length === 1
      ? "grid-cols-1"
      : photos.length === 2 || photos.length === 4
        ? "grid-cols-2"
        : "grid-cols-3";

  function show(photo: PublicPhoto) {
    setOpen(photo);
    dialog.current?.showModal();
  }

  return (
    <section aria-label={title} className="w-full">
      <ul className={`grid gap-2 ${cols}`}>
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => show(photo)}
              aria-label={
                photo.alt ? `Open photo: ${photo.alt}` : `Open photo ${i + 1}`
              }
              className="block w-full overflow-hidden rounded-xl transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {/* Native dialog: Esc closes it and focus returns to the photo. */}
      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          // A click on the dark backdrop (the dialog itself) closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        aria-label={open?.alt || "Photo"}
        className="m-auto max-h-[90dvh] max-w-[min(92vw,48rem)] overflow-visible bg-transparent p-0 backdrop:bg-black/80"
      >
        {open && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.url}
              alt={open.alt}
              className="max-h-[90dvh] w-auto rounded-xl object-contain"
            />
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className={`${circle} top-3 right-3`}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
      </dialog>
    </section>
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
