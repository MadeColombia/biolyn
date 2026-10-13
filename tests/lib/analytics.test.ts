import { describe, expect, it, vi } from "vitest";
import { fakeClient } from "../helpers/supabase";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const { getStats } = await import("@/lib/analytics");

const NOW = Date.parse("2026-10-13T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

describe("getStats", () => {
  it("counts views, clicks and top referrers", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    const views = [
      { referrer: "l.instagram.com", created_at: daysAgo(1) },
      { referrer: "l.instagram.com", created_at: daysAgo(2) },
      { referrer: null, created_at: daysAgo(10) },
      { referrer: "t.co", created_at: daysAgo(20) },
      ...["a", "b", "c", "d"].map((h) => ({
        referrer: `${h}.com`,
        created_at: daysAgo(3),
      })),
    ];
    const clicks = [{ link_id: "l1" }, { link_id: "l1" }, { link_id: "l2" }];
    const db = fakeClient({
      views: [{ data: views }],
      clicks: [{ data: clicks }],
    });

    const stats = await getStats(db as never, "p1", ["l1", "l2"]);
    vi.useRealTimers();

    expect(stats.views7).toBe(6);
    expect(stats.views30).toBe(8);
    expect(stats.clicks30).toBe(3);
    expect(stats.clicksByLink).toEqual({ l1: 2, l2: 1 });
    expect(stats.topReferrers).toHaveLength(5);
    expect(stats.topReferrers[0]).toEqual({ host: "l.instagram.com", count: 2 });
    // Seven sites, only the top five are kept.
    expect(stats.topReferrers.map((r) => r.host)).not.toContain("d.com");

    // Only this profile's rows from the last 30 days are read.
    const viewCalls = db.queries.views[0].calls;
    expect(viewCalls).toContainEqual({ method: "eq", args: ["profile_id", "p1"] });
    expect(viewCalls).toContainEqual({ method: "gte", args: ["created_at", daysAgo(30)] });
    expect(db.queries.clicks[0].calls).toContainEqual({
      method: "in",
      args: ["link_id", ["l1", "l2"]],
    });
  });

  it("skips the clicks query when there are no links", async () => {
    const db = fakeClient({ views: [{ data: null }] });
    const stats = await getStats(db as never, "p1", []);
    expect(db.from).not.toHaveBeenCalledWith("clicks");
    expect(stats).toEqual({
      views7: 0,
      views30: 0,
      clicks30: 0,
      clicksByLink: {},
      topReferrers: [],
    });
  });

  it("labels views without a referrer", async () => {
    const db = fakeClient({
      views: [{ data: [{ referrer: null, created_at: new Date().toISOString() }] }],
      clicks: [{ data: null }],
    });
    const stats = await getStats(db as never, "p1", ["l1"]);
    expect(stats.topReferrers).toEqual([{ host: "Direct or unknown", count: 1 }]);
    expect(stats.clicks30).toBe(0);
  });
});
