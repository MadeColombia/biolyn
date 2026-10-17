import { describe, expect, it } from "vitest";
import {
  dividerStyleFrom,
  isDividerStyle,
  MAX_TEXT_TITLE,
  parseTextForm,
  TEXT_MAX_CHARS,
  textBodyFrom,
  textBodyText,
} from "@/lib/blocks";
import { plainBio } from "@/lib/rich-bio";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("parseTextForm", () => {
  it("keeps a title and a formatted paragraph", () => {
    const result = parseTextForm(
      form({
        title: "  Live show ",
        body: '<b>Episode 50</b> live! <a href="tickets.example">Tickets</a>',
      }),
    );
    expect(result).toEqual({
      values: {
        title: "Live show",
        settings: {
          body: '<b>Episode 50</b> live! <a href="https://tickets.example/">Tickets</a>',
        },
      },
      links: ["https://tickets.example/"],
    });
  });

  it("allows just a title or just a paragraph", () => {
    expect(parseTextForm(form({ title: "Hi" }))).toMatchObject({
      values: { title: "Hi", settings: { body: "" } },
    });
    expect(parseTextForm(form({ body: "Hello" }))).toMatchObject({
      values: { title: null, settings: { body: "Hello" } },
    });
  });

  it("needs a title or a paragraph", () => {
    expect(parseTextForm(form({ title: " ", body: "<br>" }))).toEqual({
      error: "textEmpty",
    });
    expect(parseTextForm(new FormData())).toEqual({ error: "textEmpty" });
  });

  it("stops long titles and paragraphs", () => {
    expect(
      parseTextForm(form({ title: "x".repeat(MAX_TEXT_TITLE + 1) })),
    ).toEqual({ error: "titleTooLong" });
    expect(
      parseTextForm(form({ body: "x".repeat(TEXT_MAX_CHARS + 1) })),
    ).toEqual({ error: "textTooLong" });
    expect(
      parseTextForm(form({ body: "x".repeat(TEXT_MAX_CHARS) })),
    ).toMatchObject({ values: {} });
    expect(parseTextForm(form({ body: "<b>x</b>".repeat(300) }))).toEqual({
      error: "textTooFormatted",
    });
  });
});

describe("textBodyFrom", () => {
  it("reads the paragraph from the settings", () => {
    expect(plainBio(textBodyFrom({ body: "<b>Hi</b><br>there" }))).toBe(
      "Hi\nthere",
    );
  });

  it("copes with missing or odd settings", () => {
    for (const settings of [null, undefined, "x", [], {}, { body: 3 }]) {
      expect(textBodyFrom(settings)).toEqual([]);
      expect(textBodyText(settings)).toBe("");
    }
  });
});

describe("dividerStyleFrom", () => {
  it("reads the style, a line by default", () => {
    expect(dividerStyleFrom({ style: "space" })).toBe("space");
    expect(dividerStyleFrom({ style: "line" })).toBe("line");
    expect(dividerStyleFrom({ style: "zigzag" })).toBe("line");
    expect(dividerStyleFrom(null)).toBe("line");
    expect(isDividerStyle("space")).toBe(true);
    expect(isDividerStyle(1)).toBe(false);
  });
});
