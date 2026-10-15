import { describe, expect, it } from "vitest";
import {
  BADGE_TONES,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  CARD_TONES,
  HEADING_SIZES,
  badge,
  button,
  card,
  container,
  cx,
  heading,
  input,
} from "@/components/ui/recipes";

describe("cx", () => {
  it("joins class names and skips empty ones", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });
});

describe("button", () => {
  it("defaults to a medium primary button", () => {
    const classes = button();
    expect(classes).toContain(BUTTON_VARIANTS.primary);
    expect(classes).toContain(BUTTON_SIZES.md);
    expect(classes).toContain("focus-visible:outline-brand");
    expect(classes).not.toContain("w-full");
  });

  it.each(Object.keys(BUTTON_VARIANTS) as (keyof typeof BUTTON_VARIANTS)[])(
    "applies the %s variant",
    (variant) => {
      expect(button({ variant })).toContain(BUTTON_VARIANTS[variant]);
    },
  );

  it("applies size and full width", () => {
    const classes = button({ size: "lg", fullWidth: true });
    expect(classes).toContain(BUTTON_SIZES.lg);
    expect(classes).toContain("w-full");
  });
});

describe("card", () => {
  it("defaults to a plain card with large padding", () => {
    expect(card()).toBe(`rounded-3xl ${CARD_TONES.plain} p-8`);
  });

  it("supports tones and medium padding", () => {
    expect(card({ tone: "brand", padding: "md" })).toBe(
      `rounded-3xl ${CARD_TONES.brand} p-6`,
    );
  });

  it("leaves padding to the caller with padding none", () => {
    expect(card({ tone: "interactive", padding: "none" })).toBe(
      `rounded-3xl ${CARD_TONES.interactive}`,
    );
  });
});

describe("heading", () => {
  it("uses the display font with the section size by default", () => {
    expect(heading()).toBe(`font-display tracking-tight ${HEADING_SIZES.section}`);
  });

  it("applies the requested size", () => {
    expect(heading("display")).toContain(HEADING_SIZES.display);
  });
});

describe("input", () => {
  it("makes room for a drawn arrow on dropdowns", () => {
    expect(input({ select: true })).toContain("appearance-none");
    expect(input({ select: true })).toContain("pr-11");
    expect(input({ select: true })).not.toContain("px-4");
    expect(input()).toContain("px-4");
  });

  it("uses the brand focus ring when valid", () => {
    expect(input()).toContain("focus:border-brand");
    expect(input()).not.toContain("border-danger");
  });

  it("switches to the danger color when invalid", () => {
    expect(input({ invalid: true })).toContain("border-danger");
    expect(input({ invalid: true })).not.toContain("focus:border-brand");
  });
});

describe("badge", () => {
  it("defaults to the brand tone", () => {
    expect(badge()).toContain(BADGE_TONES.brand);
  });

  it("supports the neutral tone", () => {
    expect(badge("neutral")).toContain(BADGE_TONES.neutral);
  });
});

describe("container", () => {
  it.each([
    ["wide", "max-w-6xl"],
    ["medium", "max-w-3xl"],
    ["narrow", "max-w-md"],
  ] as const)("sets the %s width", (width, max) => {
    expect(container(width)).toBe(`mx-auto w-full px-6 ${max}`);
  });

  it("is wide by default", () => {
    expect(container()).toContain("max-w-6xl");
  });
});
