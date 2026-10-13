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
  "robots.txt",
  "sitemap.xml",
]);

const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export function validateUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    return "Use 3 to 30 characters: letters, numbers, dots or underscores.";
  }
  if (RESERVED_USERNAMES.has(username)) {
    return "That username is reserved.";
  }
  return null;
}
