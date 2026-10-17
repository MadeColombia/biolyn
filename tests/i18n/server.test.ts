import { beforeEach, describe, expect, it, vi } from "vitest";

let headerValues: Record<string, string> = {};
let cookie: string | undefined;
vi.mock("next/headers", () => ({
  headers: async () => new Headers(headerValues),
  cookies: async () => ({
    get: (name: string) =>
      name === "NEXT_LOCALE" && cookie ? { value: cookie } : undefined,
  }),
}));

const { actionTranslator, requestLocale } = await import("@/i18n/server");

describe("requestLocale", () => {
  beforeEach(() => {
    headerValues = {};
    cookie = undefined;
  });

  it("uses the language the proxy picked for the page", async () => {
    headerValues = { "x-biolyn-locale": "es", "accept-language": "en" };
    cookie = "en";
    expect(await requestLocale()).toBe("es");
  });

  it("falls back to the saved choice, then the browser", async () => {
    cookie = "es";
    expect(await requestLocale()).toBe("es");
    cookie = undefined;
    headerValues = { "accept-language": "es-AR" };
    expect(await requestLocale()).toBe("es");
    headerValues = { "x-biolyn-locale": "nope" };
    expect(await requestLocale()).toBe("en");
  });

  it("translates action messages in that language", async () => {
    cookie = "es";
    const t = await actionTranslator();
    expect(t("errors.linkMissing")).toBe("Añade un título y una URL.");
  });
});
