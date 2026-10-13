"use client";

import { useEffect } from "react";

// Counts a page view from the browser, so cached pages still count and
// most bots (which don't run JavaScript) are skipped.
export function ViewTracker({ profileId }: { profileId: string }) {
  useEffect(() => {
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => {});
  }, [profileId]);
  return null;
}
