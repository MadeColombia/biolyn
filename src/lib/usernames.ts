// Usernames that would clash with app routes or look official.
export const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "biolyn",
  "dashboard",
  "help",
  "login",
  "logout",
  "settings",
  "signup",
  "support",
  "terms",
  "privacy",
  "about",
  "_next",
  "favicon.ico",
  // Language prefixes (biolyn.link/es is the Spanish homepage).
  "en",
  "es",
  "robots.txt",
  "sitemap.xml",
]);

const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

/** Checks a username. Returns the key of an "errors" message, or null. */
export function validateUsername(
  raw: string,
): "usernameFormat" | "usernameReserved" | null {
  const username = raw.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    return "usernameFormat";
  }
  if (RESERVED_USERNAMES.has(username)) {
    return "usernameReserved";
  }
  return null;
}
