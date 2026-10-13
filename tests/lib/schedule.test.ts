import { describe, expect, it } from "vitest";
import { isLive, secondsUntilNextChange } from "@/lib/schedule";

const NOW = Date.parse("2026-10-13T12:00:00Z");
const at = (iso: string) => `2026-10-13T${iso}Z`;

describe("isLive", () => {
  it("shows links with no schedule", () => {
    expect(isLive({ starts_at: null, ends_at: null }, NOW)).toBe(true);
  });

  it("hides links that have not started yet", () => {
    expect(isLive({ starts_at: at("12:00:01"), ends_at: null }, NOW)).toBe(
      false,
    );
  });

  it("shows links from the exact start time", () => {
    expect(isLive({ starts_at: at("12:00:00"), ends_at: null }, NOW)).toBe(
      true,
    );
  });

  it("hides links from the exact end time", () => {
    expect(isLive({ starts_at: null, ends_at: at("12:00:00") }, NOW)).toBe(
      false,
    );
  });

  it("shows links inside the window", () => {
    expect(
      isLive({ starts_at: at("11:00:00"), ends_at: at("13:00:00") }, NOW),
    ).toBe(true);
  });
});

describe("secondsUntilNextChange", () => {
  it("returns null when nothing is scheduled", () => {
    expect(
      secondsUntilNextChange([{ starts_at: null, ends_at: null }], NOW),
    ).toBeNull();
    expect(secondsUntilNextChange([], NOW)).toBeNull();
  });

  it("ignores times in the past", () => {
    expect(
      secondsUntilNextChange(
        [{ starts_at: at("10:00:00"), ends_at: at("11:00:00") }],
        NOW,
      ),
    ).toBeNull();
  });

  it("picks the soonest future start or end", () => {
    expect(
      secondsUntilNextChange(
        [
          { starts_at: at("14:00:00"), ends_at: null },
          { starts_at: null, ends_at: at("12:10:00") },
          { starts_at: at("12:30:00"), ends_at: at("15:00:00") },
        ],
        NOW,
      ),
    ).toBe(600);
  });

  it("rounds partial seconds up", () => {
    expect(
      secondsUntilNextChange(
        [{ starts_at: "2026-10-13T12:00:00.200Z", ends_at: null }],
        NOW,
      ),
    ).toBe(1);
  });

  it("ignores dates that can't be read", () => {
    expect(
      secondsUntilNextChange([{ starts_at: "not a date", ends_at: null }], NOW),
    ).toBeNull();
  });
});
