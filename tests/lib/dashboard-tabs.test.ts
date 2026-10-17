import { describe, expect, it } from "vitest";
import { DASHBOARD_TABS, tabFrom, tabHref } from "@/lib/dashboard-tabs";

describe("tabFrom", () => {
  it.each(DASHBOARD_TABS)("reads %s", (tab) => {
    expect(tabFrom(tab)).toBe(tab);
    expect(tabFrom([tab, "look"])).toBe(tab);
  });

  it.each([undefined, null, "", "Look", "share", "toString", ["x"], 3])(
    "opens Content for %s",
    (value) => {
      expect(tabFrom(value)).toBe("content");
    },
  );
});

describe("tabHref", () => {
  it("keeps the plain address for Content", () => {
    expect(tabHref("content")).toBe("/dashboard");
    expect(tabHref("stats")).toBe("/dashboard?tab=stats");
  });
});
