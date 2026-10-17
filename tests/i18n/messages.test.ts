import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/i18n/messages";
import { LOCALES } from "@/i18n/locale";
import { translator } from "@/i18n/translate";

type Tree = { [key: string]: string | Tree };

/** Every message as "namespace.key" -> text. */
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[`${prefix}${key}`, value]]
        : Object.entries(flatten(value, `${prefix}${key}.`)),
    ),
  );
}

/**
 * {name}, {count, plural, ...} and <tag> placeholders a message uses.
 * Only names at the top level count: the words inside a plural or
 * select ("{metric, select, clicks {clics} ...}") are text, not names.
 */
function placeholders(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) args.push(/^\{\s*(\w+)/.exec(text.slice(i))![1]);
      depth++;
    } else if (text[i] === "}") depth--;
  }
  const tags = [...text.matchAll(/<(\w+)>/g)].map((m) => `<${m[1]}>`);
  return [...new Set([...args, ...tags])].sort();
}

const en = flatten(MESSAGES.en);

describe("messages", () => {
  it.each(LOCALES)("%s has exactly the same keys as English", (locale) => {
    expect(Object.keys(flatten(MESSAGES[locale])).sort()).toEqual(
      Object.keys(en).sort(),
    );
  });

  it.each(LOCALES)("%s uses the same placeholders as English", (locale) => {
    const messages = flatten(MESSAGES[locale]);
    for (const [key, text] of Object.entries(en)) {
      expect(placeholders(messages[key]), key).toEqual(placeholders(text));
    }
  });

  it.each(LOCALES)("%s has no empty messages", (locale) => {
    for (const [key, text] of Object.entries(flatten(MESSAGES[locale]))) {
      expect(text.trim(), key).not.toBe("");
    }
  });

  // House style: the name is always lowercase, and no em dashes.
  it.each(LOCALES)("%s follows the writing rules", (locale) => {
    for (const [key, text] of Object.entries(flatten(MESSAGES[locale]))) {
      expect(text, key).not.toMatch(/Biolyn/);
      expect(text, key).not.toMatch(/—/);
    }
  });

  it.each(LOCALES)("%s formats every message without errors", (locale) => {
    const t = translator(locale);
    const values = {
      count: 2, max: 5, n: 3, total: 4, name: "Ana", alt: "a", start: "a",
      end: "b", from: "a", to: "b", day: "a", metric: "views", style: "a",
      service: "youtube", platform: "X", problem: "p", language: "English", app: "WhatsApp",
      email: () => "e", star: () => "*", b: () => "b",
    };
    for (const key of Object.keys(en)) {
      // Rich messages only render through t.rich.
      const text = key.includes("requiredNote") || key.endsWith("checkText") || key === "photos.required"
        ? t.rich(key as never, values as never)
        : t(key as never, values as never);
      expect(String(text), key).not.toContain(key);
    }
  });

  it("picks the right words in plurals and choices", () => {
    const es = translator("es");
    const en = translator("en");
    expect(en("linkList.photoCount", { count: 1 })).toBe("1 photo");
    expect(es("linkList.photoCount", { count: 3 })).toBe("3 fotos");
    expect(en("linkForm.detected", { service: "apple" })).toBe(
      "This is an Apple Music link!",
    );
    expect(es("analytics.inLast", { metric: "clicks", n: 7 })).toBe(
      "clics en los últimos 7 días",
    );
  });
});
