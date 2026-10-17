import { describe, expect, it } from "vitest";
import {
  bioLinks,
  cleanBio,
  normalizeBioHref,
  parseBio,
  plainBio,
  sanitizeBio,
  serializeBio,
} from "@/lib/rich-bio";

const roundTrip = (s: string) => serializeBio(parseBio(s));

describe("parseBio", () => {
  it("reads old plain bios unchanged", () => {
    expect(parseBio("Hi, I make videos")).toEqual([
      { type: "text", text: "Hi, I make videos" },
    ]);
    expect(parseBio(null)).toEqual([]);
    expect(parseBio(undefined)).toEqual([]);
  });

  it("reads every supported tag, nested", () => {
    expect(
      parseBio('<b>bold <i>both</i></b><br><u>u</u><s>s</s><a href="https://a.com/">a</a>'),
    ).toEqual([
      {
        type: "mark",
        mark: "b",
        children: [
          { type: "text", text: "bold " },
          { type: "mark", mark: "i", children: [{ type: "text", text: "both" }] },
        ],
      },
      { type: "br" },
      { type: "mark", mark: "u", children: [{ type: "text", text: "u" }] },
      { type: "mark", mark: "s", children: [{ type: "text", text: "s" }] },
      { type: "link", href: "https://a.com/", children: [{ type: "text", text: "a" }] },
    ]);
  });

  it("accepts <br/> and <br />", () => {
    expect(parseBio("a<br/>b<br />c").filter((n) => n.type === "br")).toHaveLength(2);
  });

  it("keeps unknown tags as plain text", () => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(1)><a href="x" onclick="y">z</a><B>no</B>';
    // The stray </a> has nothing to close, so it is dropped.
    expect(plainBio(parseBio(evil))).toBe(evil.replace("</a>", ""));
    expect(parseBio(evil).every((n) => n.type === "text")).toBe(true);
  });

  it("decodes entities", () => {
    expect(plainBio(parseBio("a &lt;b&gt; &amp; &quot;c&quot; &nbsp;"))).toBe(
      'a <b> & "c" &nbsp;',
    );
    expect(parseBio('<a href="https://a.com/?x=1&amp;y=&quot;">a</a>')[0]).toMatchObject({
      href: 'https://a.com/?x=1&y="',
    });
  });

  it("closes tags left open and drops stray closing tags", () => {
    expect(roundTrip("<b>a<i>b")).toBe("<b>a<i>b</i></b>");
    expect(roundTrip("a</b></a>b")).toBe("ab");
    expect(roundTrip("<b>a<i>b</b>c")).toBe("<b>a<i>b</i></b>c");
    expect(roundTrip('<a href="https://a.com/">a<b>b</a>c')).toBe(
      '<a href="https://a.com/">a<b>b</b></a>c',
    );
  });
});

describe("serializeBio", () => {
  it("escapes text and link addresses", () => {
    expect(
      serializeBio([
        { type: "text", text: '<script>&"' },
        { type: "link", href: 'https://a.com/"><script>', children: [{ type: "text", text: "x" }] },
      ]),
    ).toBe('&lt;script&gt;&amp;"<a href="https://a.com/&quot;&gt;&lt;script&gt;">x</a>');
  });

  it("round trips its own output", () => {
    const s = '<b>a &amp; b</b><br><a href="https://a.com/?q=&quot;x&quot;">l</a>';
    expect(roundTrip(roundTrip(s))).toBe(roundTrip(s));
  });
});

describe("plainBio and bioLinks", () => {
  const nodes = parseBio('<b>Hi</b><br><i><a href="https://a.com/">a</a></i>');
  it("joins the words", () => {
    expect(plainBio(nodes)).toBe("Hi\na");
    expect(plainBio(nodes, " ")).toBe("Hi a");
  });
  it("finds links inside formatting", () => {
    expect(bioLinks(nodes)).toEqual(["https://a.com/"]);
  });
});

describe("normalizeBioHref", () => {
  it.each([
    ["example.com", "https://example.com/"],
    [" https://a.com/x ", "https://a.com/x"],
    ["http://a.com", "http://a.com/"],
  ])("accepts %s", (raw, href) => {
    expect(normalizeBioHref(raw)).toBe(href);
  });

  it.each([
    "",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,x",
    "mailto:a@b.co",
    "https://",
    `https://a.com/${"x".repeat(300)}`,
  ])("rejects %s", (raw) => {
    expect(normalizeBioHref(raw)).toBeNull();
  });
});

describe("cleanBio", () => {
  const clean = (s: string) => serializeBio(cleanBio(parseBio(s)));

  it("unwraps links with a bad address and keeps the words", () => {
    expect(clean('<a href="javascript:alert(1)">click</a>')).toBe("click");
  });

  it("unwraps links inside links", () => {
    expect(
      clean('<a href="https://a.com/">x<a href="https://b.com/">y</a></a>'),
    ).toBe('<a href="https://a.com/">xy</a>');
  });

  it("drops empty formatting", () => {
    expect(clean("<b></b><i> </i>a<u><br></u>")).toBe("a<u><br></u>");
  });

  it("limits blank lines and trims breaks at the ends", () => {
    expect(clean("<br><br>a<br><br><br><br>b<br>")).toBe("a<br><br>b");
  });
});

describe("sanitizeBio", () => {
  it("returns the clean bio and its links", () => {
    expect(sanitizeBio('<b>Hi</b> <a href="a.com">site</a>')).toEqual({
      bio: '<b>Hi</b> <a href="https://a.com/">site</a>',
      links: ["https://a.com/"],
    });
  });

  it("stores an empty bio as empty", () => {
    expect(sanitizeBio("<b> </b><br>")).toEqual({ bio: "", links: [] });
    expect(sanitizeBio("   ")).toEqual({ bio: "", links: [] });
  });

  it("counts only the words toward 160 characters", () => {
    expect(sanitizeBio(`<b>${"a".repeat(160)}</b>`)).toMatchObject({
      bio: `<b>${"a".repeat(160)}</b>`,
    });
    expect(sanitizeBio("a".repeat(161))).toEqual({
      error: "bioTooLong",
    });
  });

  it("refuses too much formatting", () => {
    expect(sanitizeBio("<b><i><u><s>a</s></i></u></b>".repeat(60))).toEqual({
      error: "bioTooFormatted",
    });
  });
});
