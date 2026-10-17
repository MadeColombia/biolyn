import { describe, expect, it } from "vitest";
import {
  fromAcceptLanguage,
  homePath,
  isLocale,
  pickLocale,
} from "@/i18n/locale";

describe("locales", () => {
  it("knows its languages", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("reads the browser's languages in order of preference", () => {
    expect(fromAcceptLanguage("es-CO,es;q=0.9,en;q=0.8")).toBe("es");
    expect(fromAcceptLanguage("en-US,en;q=0.9,es;q=0.8")).toBe("en");
    expect(fromAcceptLanguage("fr-FR,fr;q=0.9,es;q=0.5,en;q=0.4")).toBe("es");
    expect(fromAcceptLanguage("en;q=0.2, ES-mx")).toBe("es");
    expect(fromAcceptLanguage("es;q=0,en")).toBe("en");
    expect(fromAcceptLanguage("es;q=abc,en;q=0.1")).toBe("en");
    expect(fromAcceptLanguage("fr, de")).toBeNull();
    expect(fromAcceptLanguage("")).toBeNull();
    expect(fromAcceptLanguage(null)).toBeNull();
  });

  it("prefers a saved choice, then the browser, then English", () => {
    expect(pickLocale("en", "es")).toBe("en");
    expect(pickLocale("xx", "es")).toBe("es");
    expect(pickLocale(undefined, null)).toBe("en");
  });

  it("gives each homepage its address", () => {
    expect(homePath("en")).toBe("/");
    expect(homePath("es")).toBe("/es");
  });
});
