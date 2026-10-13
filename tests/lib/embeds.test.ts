import { describe, expect, it } from "vitest";
import { embedFor } from "@/lib/embeds";

const YT = "dQw4w9WgXcQ";
const SP = "4cOdK2wGLETKBW3PvgPWqT";

describe("embedFor: YouTube", () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT}`,
    `https://m.youtube.com/watch?v=${YT}&t=10`,
    `https://music.youtube.com/watch?v=${YT}`,
    `https://youtu.be/${YT}`,
    `https://youtube.com/shorts/${YT}`,
    `https://youtube.com/embed/${YT}`,
    `https://youtube.com/live/${YT}`,
  ])("embeds %s", (url) => {
    expect(embedFor(url)).toEqual({
      src: `https://www.youtube-nocookie.com/embed/${YT}`,
      kind: "youtube",
      tall: false,
    });
  });

  it.each([
    "https://youtube.com/watch",
    "https://youtube.com/watch?v=short",
    `https://youtube.com/watch?v=${YT}"><script>`,
    "https://youtu.be/",
    "https://youtube.com/shorts/",
    `https://youtube.com/channel/${YT}`,
    `https://evil.com/watch?v=${YT}`,
    `https://youtube.com.evil.com/watch?v=${YT}`,
  ])("refuses %s", (url) => {
    expect(embedFor(url)).toBeNull();
  });
});

describe("embedFor: Spotify", () => {
  it("embeds a track as a short player", () => {
    expect(embedFor(`https://open.spotify.com/track/${SP}`)).toEqual({
      src: `https://open.spotify.com/embed/track/${SP}`,
      kind: "spotify",
      tall: false,
    });
  });

  it("embeds an episode as a short player", () => {
    expect(embedFor(`https://open.spotify.com/episode/${SP}`)?.tall).toBe(
      false,
    );
  });

  it.each(["album", "playlist", "show", "artist"])(
    "embeds a %s as a tall player",
    (type) => {
      expect(embedFor(`https://open.spotify.com/${type}/${SP}`)).toEqual({
        src: `https://open.spotify.com/embed/${type}/${SP}`,
        kind: "spotify",
        tall: true,
      });
    },
  );

  it("handles the language prefix", () => {
    expect(embedFor(`https://open.spotify.com/intl-es/track/${SP}?si=x`)?.src).toBe(
      `https://open.spotify.com/embed/track/${SP}`,
    );
  });

  it.each([
    `https://open.spotify.com/user/${SP}`,
    "https://open.spotify.com/track/short",
    "https://open.spotify.com/track",
    "https://open.spotify.com/",
    `https://spotify.com/track/${SP}`,
  ])("refuses %s", (url) => {
    expect(embedFor(url)).toBeNull();
  });
});

describe("embedFor: anything else", () => {
  it.each(["not a url", "", "https://example.com", "javascript:alert(1)"])(
    "returns null for %s",
    (url) => {
      expect(embedFor(url)).toBeNull();
    },
  );
});
