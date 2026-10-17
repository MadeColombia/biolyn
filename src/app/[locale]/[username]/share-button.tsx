"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SocialIcon } from "@/components/social-icon";
import {
  prefersNativeShare,
  profileShareUrl,
  SHARE_APPS,
  shareLink,
  type ShareApp,
} from "@/lib/share";

// Official brand glyphs from Simple Icons (https://simpleicons.org, CC0).
const WHATSAPP =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";
const FACEBOOK =
  "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z";

// Each app's own color, so visitors spot theirs at a glance.
const APP_LOOK: Record<ShareApp, { name: string; circle: string }> = {
  whatsapp: { name: "WhatsApp", circle: "bg-[#25D366] text-white" },
  x: { name: "X", circle: "bg-black text-white" },
  facebook: { name: "Facebook", circle: "bg-[#0866FF] text-white" },
  email: { name: "", circle: "bg-stone-600 text-white" },
};

function AppIcon({ app }: { app: ShareApp }) {
  if (app === "x" || app === "email") return <SocialIcon id={app} />;
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d={app === "whatsapp" ? WHATSAPP : FACEBOOK} />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
      <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
    </svg>
  );
}

/**
 * The share button in the top right corner of a public page. Phones open
 * their own share menu; computers get a small popup with the link and a
 * few apps. Over a cover photo the button gets a soft white backing so
 * it stays readable on any picture.
 */
export function ShareButton({
  username,
  name,
  avatarUrl,
  onPhoto,
}: {
  username: string;
  name: string;
  avatarUrl: string | null;
  onPhoto: boolean;
}) {
  const t = useTranslations("profile.share");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const popupId = useId();
  const title = `${name} | biolyn`;

  // The address uses the browser's own domain (previews and local copies
  // included). The popup only shows after a tap, so window is there.
  const pageUrl = () => profileShareUrl(window.location.origin, username);
  const url = open ? pageUrl() : "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    const data = { title, url: pageUrl() };
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (prefersNativeShare(navigator, touch, data)) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        // The visitor closed the menu: nothing to do.
        if ((error as Error).name === "AbortError") return;
      }
    }
    setOpen((o) => !o);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopied(true);
    } catch {
      // Some browsers block the clipboard. Selecting the link lets the
      // visitor copy it themselves.
      field.current?.select();
    }
  }

  return (
    <div ref={box} className="absolute top-4 right-4 z-20">
      <button
        ref={button}
        type="button"
        onClick={share}
        aria-label={t("button")}
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        className={`flex size-11 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-md transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current motion-safe:hover:scale-105 ${
          onPhoto
            ? "border-white/50 bg-white/70 text-neutral-900"
            : "border-current/15 bg-current/10"
        }`}
      >
        {/* bg-current tints the backing with the theme's own text color. */}
        <ShareIcon />
      </button>
      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-label={t("title")}
          className="absolute top-14 right-0 flex w-[min(21rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl bg-white p-5 text-left text-stone-900 shadow-2xl ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between">
            <p className="font-bold">{t("title")}</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
              aria-label={t("close")}
              className="flex size-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="size-11 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-11 items-center justify-center rounded-full bg-stone-200 font-bold text-stone-600">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-sm text-stone-500">
                {url.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 py-1.5 pr-1.5 pl-3.5">
            <input
              ref={field}
              readOnly
              value={url.replace(/^https?:\/\//, "")}
              aria-label={t("link")}
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-700 outline-none"
            />
            <button
              type="button"
              onClick={copy}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition ${
                copied
                  ? "bg-green-700 text-white"
                  : "bg-brand text-on-brand hover:bg-brand-hover"
              }`}
            >
              <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
            </button>
          </div>
          <ul className="flex justify-between">
            {SHARE_APPS.map((app) => {
              const label = app === "email" ? t("email") : APP_LOOK[app].name;
              return (
                <li key={app} className="flex-1">
                  <a
                    href={shareLink(app, url, title)}
                    target={app === "email" ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    aria-label={t("on", { app: label })}
                    className="flex flex-col items-center gap-1.5 text-xs text-stone-600"
                  >
                    <span
                      className={`flex size-12 items-center justify-center rounded-full transition motion-safe:hover:scale-105 ${APP_LOOK[app].circle}`}
                    >
                      <AppIcon app={app} />
                    </span>
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
