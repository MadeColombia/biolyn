import { describe, expect, it, vi } from "vitest";
import { fakeClient } from "../helpers/supabase";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const { getAnalytics, summarize } = await import("@/lib/analytics");

const NOW = Date.parse("2026-10-13T12:00:00Z");

describe("getAnalytics", () => {
  it("asks the database for 180 days and names each channel", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const db = fakeClient();
    db.rpc.mockResolvedValueOnce({
      data: [
        { d: "2026-10-13", k: "v", l: null, s: "tiktok", r: "t.co", n: 2 },
        { d: "2026-10-13", k: "v", l: null, s: null, r: "l.instagram.com", n: 1 },
        { d: "2026-10-13", k: "v", l: null, s: null, r: "instagram.com", n: 4 },
        { d: "2026-10-12", k: "c", l: "l1", s: null, r: "https://biolyn.link/ethan", n: 3 },
        { d: "2026-10-12", k: "c", l: "l1", s: null, r: null, n: "2" },
        // A tag nobody created counts by its site.
        { d: "2026-10-13", k: "v", l: null, s: "made-up", r: "t.co", n: 1 },
      ],
      error: null,
    });

    const data = await getAnalytics(db as never, "p1", ["tiktok"]);
    vi.useRealTimers();

    expect(db.rpc).toHaveBeenCalledWith("analytics_daily", {
      p_profile_id: "p1",
      p_since: "2026-04-17T00:00:00Z",
    });
    expect(data.today).toBe("2026-10-13");
    expect(data.rows).toEqual([
      { day: "2026-10-13", kind: "view", link: null, channel: "s:tiktok", count: 2 },
      // Two Instagram redirect sites add up to one channel.
      { day: "2026-10-13", kind: "view", link: null, channel: "r:Instagram", count: 5 },
      // Old clicks stored our own page address: unknown, merged.
      { day: "2026-10-12", kind: "click", link: "l1", channel: "direct", count: 5 },
      { day: "2026-10-13", kind: "view", link: null, channel: "r:X (Twitter)", count: 1 },
    ]);
  });

  it("returns no rows when the database fails", async () => {
    const db = fakeClient();
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    const data = await getAnalytics(db as never, "p1", []);
    expect(data.rows).toEqual([]);
  });

  it("treats a bad count as zero", async () => {
    const db = fakeClient();
    db.rpc.mockResolvedValueOnce({
      data: [{ d: "2026-10-13", k: "v", l: "x", s: null, r: null, n: "?" }],
      error: null,
    });
    const data = await getAnalytics(db as never, "p1", []);
    expect(data.rows[0]).toMatchObject({ link: null, count: 0 });
  });
});

describe("summarize", () => {
  const view = (day: string, channel: string, count: number) => ({
    day, kind: "view" as const, link: null, channel, count,
  });
  const click = (day: string, link: string | null, count: number) => ({
    day, kind: "click" as const, link, channel: "direct", count,
  });

  it("counts views, clicks and the top channels", () => {
    const stats = summarize({
      today: "2026-10-13",
      rows: [
        view("2026-10-13", "r:Instagram", 3),
        view("2026-10-07", "r:Instagram", 1), // 7 days counts the 7th
        view("2026-10-06", "s:tiktok", 2), // outside 7, inside 30
        view("2026-09-14", "direct", 1), // 30th day back
        view("2026-09-13", "direct", 50), // too old
        ...["a", "b", "c", "d"].map((c) => view("2026-10-01", `r:${c}`, 1)),
        click("2026-10-10", "l1", 2),
        click("2026-10-11", "l1", 1),
        click("2026-10-11", null, 1),
        click("2026-08-01", "l2", 9),
      ],
    });
    expect(stats.views7).toBe(4);
    expect(stats.views30).toBe(11);
    expect(stats.clicks30).toBe(4);
    expect(stats.clicksByLink).toEqual({ l1: 3 });
    expect(stats.topChannels).toHaveLength(5);
    expect(stats.topChannels[0]).toEqual({ key: "r:Instagram", count: 4 });
    expect(stats.topChannels[1]).toEqual({ key: "s:tiktok", count: 2 });
  });

  it("is all zeros without data", () => {
    expect(summarize({ today: "2026-10-13", rows: [] })).toEqual({
      views7: 0,
      views30: 0,
      clicks30: 0,
      clicksByLink: {},
      topChannels: [],
    });
  });
});
