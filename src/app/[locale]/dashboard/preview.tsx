"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { button, cx } from "@/components/ui";
import { previewSrc } from "@/lib/preview";

// Computers show the preview next to the editor (Tailwind's lg).
const WIDE = "(min-width: 64rem)";

function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

type PreviewProps = {
  username: string;
  /** Changes whenever the page changes, which reloads the preview. */
  version: string;
};

/**
 * On computers: the real public page in a phone-sized frame next to the
 * editor. It stays in view while scrolling and reloads after each save.
 * Phones load nothing here; they use PreviewButton.
 */
export function PreviewPanel(props: PreviewProps) {
  const t = useTranslations("dashboard");
  const wide = useWide();
  return (
    <aside
      aria-label={t("preview")}
      className="sticky top-4 hidden flex-col gap-2 lg:flex"
    >
      <p className="px-2 text-sm text-ink-muted">{t("previewNote")}</p>
      <div className="overflow-hidden rounded-[2rem] border-8 border-raised bg-surface shadow-lg">
        {wide && (
          <PreviewFrame
            {...props}
            className="h-[min(52rem,calc(100dvh-6rem))] w-full"
          />
        )}
      </div>
    </aside>
  );
}

/**
 * On phones: a Preview button above the tabs that opens the page full
 * screen. The page only loads while it's open.
 */
export function PreviewButton(props: PreviewProps) {
  const t = useTranslations("dashboard");
  const common = useTranslations("common");
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-bold text-canvas shadow-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-95 lg:hidden"
      >
        <EyeIcon />
        {t("preview")}
      </button>
      <dialog
        ref={dialog}
        aria-label={t("previewTitle")}
        onClose={() => setOpen(false)}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-canvas p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-edge px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
            <p className="py-3 font-bold">{t("previewTitle")}</p>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={button({ variant: "secondary", size: "sm" })}
            >
              {common("close")}
            </button>
          </div>
          {open && <PreviewFrame {...props} className="w-full flex-1" />}
        </div>
      </dialog>
    </>
  );
}

// The page itself. After a save the address gets a new version, and the
// frame reloads in place, back at the same scroll position.
function PreviewFrame({
  username,
  version,
  className,
}: PreviewProps & { className: string }) {
  const t = useTranslations("dashboard");
  const frame = useRef<HTMLIFrameElement>(null);
  const shown = useRef(version);
  const scroll = useRef(0);
  // The first address only; later ones are loaded by the effect below.
  const [src] = useState(() => previewSrc(username, version));

  useEffect(() => {
    if (shown.current === version) return;
    shown.current = version;
    const win = frame.current?.contentWindow;
    if (!win) return;
    scroll.current = win.scrollY;
    win.location.replace(previewSrc(username, version));
  }, [username, version]);

  return (
    <iframe
      ref={frame}
      src={src}
      title={t("previewTitle")}
      onLoad={() => {
        const win = frame.current?.contentWindow;
        const y = scroll.current;
        scroll.current = 0;
        if (win && y > 0) keepScroll(win, y);
      }}
      className={cx("block bg-surface", className)}
    />
  );
}

// The page's blocks arrive just after it loads, so it's too short to
// scroll at first. Keep trying each frame until it gets there, for a few
// seconds at most.
function keepScroll(win: Window, y: number) {
  const until = Date.now() + 3000;
  const step = () => {
    win.scrollTo(0, y);
    if (win.scrollY < y - 1 && Date.now() < until) {
      win.requestAnimationFrame(step);
    }
  };
  step();
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
