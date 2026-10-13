// Turns a YouTube or Spotify link into the address of its embeddable
// player, or returns null for any other link.
export type Embed = { src: string; kind: "youtube" | "spotify"; tall: boolean };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_TYPES = [
  "track",
  "album",
  "playlist",
  "episode",
  "show",
  "artist",
];

export function embedFor(raw: string): Embed | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  let videoId: string | null = null;
  if (host === "youtu.be") videoId = parts[0] ?? null;
  if (host === "youtube.com") {
    if (parts[0] === "watch") videoId = url.searchParams.get("v");
    if (["shorts", "embed", "live"].includes(parts[0] ?? "")) {
      videoId = parts[1] ?? null;
    }
  }
  if (videoId && YT_ID.test(videoId)) {
    return {
      src: `https://www.youtube-nocookie.com/embed/${videoId}`,
      kind: "youtube",
      tall: false,
    };
  }

  if (host === "open.spotify.com") {
    // Links can carry a language prefix: /intl-es/track/<id>
    const rest = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
    const [type, id] = rest;
    if (
      type &&
      id &&
      SPOTIFY_TYPES.includes(type) &&
      /^[A-Za-z0-9]{22}$/.test(id)
    ) {
      return {
        src: `https://open.spotify.com/embed/${type}/${id}`,
        kind: "spotify",
        tall: type !== "track" && type !== "episode",
      };
    }
  }
  return null;
}
