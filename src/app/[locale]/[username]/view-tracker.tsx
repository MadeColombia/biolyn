"use client";

import { useEffect } from "react";
import { referrerHost, SOURCE_PARAM, sourceFromSearch } from "@/lib/sources";
import { isPreview, PREVIEW_PARAM } from "@/lib/preview";

// Counts a page view from the browser, so cached pages still count and
// most bots (which don't run JavaScript) are skipped.
//
// It also reads where the visitor came from (?s=tiktok, ?utm_source=...
// or the site that sent them) and adds it to every link on the page, so
// clicks are counted for the same source as the view.
//
// In the dashboard's preview (?preview=...) nothing is counted, and links
// open in a new tab instead of inside the preview.
export function ViewTracker({ profileId }: { profileId: string }) {
  useEffect(() => {
    if (isPreview(window.location.search)) return openLinksOutside();

    const source = sourceFromSearch(window.location.search);
    const site = referrerHost(document.referrer, window.location.hostname);

    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        referrer: document.referrer,
        source,
      }),
      keepalive: true,
    }).catch(() => {});

    if (!source && !site) return;
    for (const a of document.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/api/click/"]',
    )) {
      const url = new URL(a.href);
      if (source) url.searchParams.set(SOURCE_PARAM, source);
      if (site) url.searchParams.set("r", site);
      a.href = url.pathname + url.search;
    }
  }, [profileId]);
  return null;
}

// Sends every link click to a new tab. Click links keep the preview mark,
// so the owner's own clicks aren't counted either.
function openLinksOutside() {
  function onClick(event: MouseEvent) {
    const a = (event.target as Element | null)?.closest?.("a[href]");
    if (!(a instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    const url = new URL(a.href);
    if (url.pathname.startsWith("/api/click/")) {
      url.searchParams.set(PREVIEW_PARAM, "1");
    }
    window.open(url, "_blank", "noopener");
  }
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
