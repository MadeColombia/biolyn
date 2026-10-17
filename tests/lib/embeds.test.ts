import { describe, expect, it } from "vitest";
import { embedFor, youtubeThumbnail } from "@/lib/embeds";

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

describe("embedFor: Apple Music", () => {
  const ALBUM = "1440857781";
  const SONG = "1440857786";
  const PLAYLIST = "pl.f4d106fed2bd41149aaacabb233eb5eb";

  it("embeds an album as a tall player", () => {
    expect(
      embedFor(`https://music.apple.com/us/album/some-album/${ALBUM}`),
    ).toEqual({
      src: `https://embed.music.apple.com/us/album/some-album/${ALBUM}`,
      kind: "apple",
      tall: true,
    });
  });

  it("embeds one song of an album as a short player", () => {
    expect(
      embedFor(`https://music.apple.com/es/album/x/${ALBUM}?i=${SONG}`),
    ).toEqual({
      src: `https://embed.music.apple.com/es/album/x/${ALBUM}?i=${SONG}`,
      kind: "apple",
      tall: false,
    });
  });

  it("embeds a song link as a short player", () => {
    expect(embedFor(`https://music.apple.com/us/song/x/${SONG}`)).toEqual({
      src: `https://embed.music.apple.com/us/song/x/${SONG}`,
      kind: "apple",
      tall: false,
    });
  });

  it.each([`todays-hits/${PLAYLIST}`, PLAYLIST])(
    "embeds the playlist link /us/playlist/%s",
    (path) => {
      expect(embedFor(`https://music.apple.com/us/playlist/${path}`)).toEqual({
        src: `https://embed.music.apple.com/us/playlist/${path}`,
        kind: "apple",
        tall: true,
      });
    },
  );

  it("keeps odd characters in the name from breaking the address", () => {
    expect(
      embedFor(`https://music.apple.com/us/album/a"b/${ALBUM}`)?.src,
    ).toBe(`https://embed.music.apple.com/us/album/a%22b/${ALBUM}`);
  });

  it.each([
    `https://music.apple.com/us/artist/x/${ALBUM}`,
    `https://music.apple.com/usa/album/x/${ALBUM}`,
    `https://music.apple.com/album/x/${ALBUM}`,
    `https://music.apple.com/us/album/x/not-a-number`,
    `https://music.apple.com/us/album/x/${ALBUM}?i=abc`,
    `https://music.apple.com/us/album/a/b/${ALBUM}`,
    `https://music.apple.com/us/playlist/x/${ALBUM}`,
    `https://music.apple.com/us/song/x/pl.abc`,
    "https://music.apple.com/us/album",
    `https://apple.com/us/album/x/${ALBUM}`,
    `https://music.apple.com.evil.com/us/album/x/${ALBUM}`,
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

describe("youtubeThumbnail", () => {
  it("gives the video's picture for YouTube links", () => {
    expect(youtubeThumbnail("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    expect(
      youtubeThumbnail("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5"),
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it.each([
    "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    "https://example.com",
    "not a url",
  ])("gives nothing for %s", (url) => {
    expect(youtubeThumbnail(url)).toBeNull();
  });
});
