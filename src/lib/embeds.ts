// Turns a YouTube, Spotify or Apple Music link into the address of its
// embeddable player, or returns null for any other link.
export type Embed = {
  src: string;
  kind: "youtube" | "spotify" | "apple";
  tall: boolean;
};

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
  if (url.hostname === "music.apple.com") return appleMusic(url);
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

// music.apple.com/<country>/<type>/<optional-name>/<id>
// A song inside an album link is ?i=<song id>, which plays just that song.
const APPLE_TYPES = ["album", "playlist", "song"];

function appleMusic(url: URL): Embed | null {
  const parts = url.pathname.split("/").filter(Boolean);
  const [country, type] = parts;
  const id = parts.at(-1);
  if (
    !country ||
    !/^[a-z]{2}$/.test(country) ||
    !type ||
    !APPLE_TYPES.includes(type) ||
    parts.length < 3 ||
    parts.length > 4 ||
    !id
  ) {
    return null;
  }
  const validId =
    type === "playlist" ? /^pl\.[A-Za-z0-9-]+$/.test(id) : /^\d+$/.test(id);
  if (!validId) return null;

  const song = type === "album" ? url.searchParams.get("i") : null;
  if (song !== null && !/^\d+$/.test(song)) return null;

  return {
    src:
      `https://embed.music.apple.com/${parts.join("/")}` +
      (song ? `?i=${song}` : ""),
    kind: "apple",
    tall: type !== "song" && !song,
  };
}

// The video's own thumbnail for a YouTube link, so a link card in a
// carousel has a picture even when the owner didn't add one.
export function youtubeThumbnail(raw: string): string | null {
  const embed = embedFor(raw);
  if (embed?.kind !== "youtube") return null;
  const id = embed.src.split("/").at(-1);
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
