// Sharing a public page: the address to share, the apps the computer
// popup offers, and when to use the phone's own share menu instead.

/** The page's own address, without the extras a visitor may have come
 * in with (like a tracking link's ?s=code). */
export function profileShareUrl(origin: string, username: string): string {
  return `${origin.replace(/\/+$/, "")}/${encodeURIComponent(username)}`;
}

export const SHARE_APPS = ["whatsapp", "x", "facebook", "email"] as const;
export type ShareApp = (typeof SHARE_APPS)[number];

/** Where each app's share button goes, with the page already filled in. */
export function shareLink(app: ShareApp, url: string, title: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (app) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
    case "x":
      return `https://x.com/intent/tweet?text=${t}&url=${u}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "email":
      return `mailto:?subject=${t}&body=${u}`;
  }
}

type ShareNavigator = {
  share?: unknown;
  canShare?: (data: ShareData) => boolean;
};

/**
 * Phones and tablets get their own share menu. Computers get our popup,
 * even when the browser has a share menu too (it's small and easy to
 * miss there), and so does any browser without one.
 */
export function prefersNativeShare(
  nav: ShareNavigator,
  touchScreen: boolean,
  data: ShareData,
): boolean {
  if (!touchScreen || typeof nav.share !== "function") return false;
  return nav.canShare ? nav.canShare(data) : true;
}
