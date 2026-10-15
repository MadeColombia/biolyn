import { describe, expect, it } from "vitest";
import {
  ALL,
  addDays,
  buildChart,
  change,
  compactNumber,
  dayList,
  isRange,
  niceScale,
  ranked,
  shortDate,
  type Analytics,
  type ChartOptions,
  type DailyRow,
} from "@/lib/chart";

const TODAY = "2026-10-15";
const v = (day: string, channel: string, count = 1): DailyRow => ({
  day, kind: "view", link: null, channel, count,
});
const c = (day: string, link: string, channel = "direct", count = 1): DailyRow => ({
  day, kind: "click", link, channel, count,
});

const data: Analytics = {
  today: TODAY,
  rows: [
    v("2026-10-15", "s:tiktok", 3),
    v("2026-10-14", "r:Instagram", 2),
    v("2026-10-09", "s:tiktok", 1), // first day of a 7 day range
    v("2026-10-08", "direct", 4), // the 7 days before
    v("2026-10-02", "r:Instagram", 5), // previous period, first day
    v("2026-10-01", "direct", 9), // outside both 7 day periods
    c("2026-10-15", "l1", "s:tiktok", 2),
    c("2026-10-13", "l2", "direct", 1),
  ],
};
const labels = {
  channel: (k: string) => k.toUpperCase(),
  links: { l1: "Shop" } as Record<string, string>,
};
const opts = (o: Partial<ChartOptions> = {}): ChartOptions => ({
  metric: "views",
  range: 7,
  source: ALL,
  link: ALL,
  compare: "none",
  picked: [],
  ...o,
});

describe("days", () => {
  it("adds and lists days across months", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(dayList(TODAY, 3)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
  });
  it("knows the ranges", () => {
    expect(isRange(30)).toBe(true);
    expect(isRange(14)).toBe(false);
  });
  it("writes short dates", () => {
    expect(shortDate("2026-10-05")).toBe("Oct 5");
  });
});

describe("buildChart", () => {
  it("draws one line of views for the range", () => {
    const chart = buildChart(data, opts(), labels);
    expect(chart.days).toHaveLength(7);
    expect(chart.series).toHaveLength(1);
    expect(chart.series[0]).toMatchObject({ key: "main", label: "Views", kind: "main" });
    expect(chart.series[0].values).toEqual([1, 0, 0, 0, 0, 2, 3]);
    expect(chart.total).toBe(6);
    expect(chart.previousTotal).toBe(9);
  });

  it("filters by source", () => {
    const chart = buildChart(data, opts({ source: "s:tiktok" }), labels);
    expect(chart.total).toBe(4);
    expect(chart.previousTotal).toBe(0);
  });

  it("adds the previous period as a second line", () => {
    const chart = buildChart(data, opts({ compare: "previous" }), labels);
    expect(chart.series.map((s) => s.kind)).toEqual(["main", "previous"]);
    expect(chart.series[1].label).toBe("Previous 7 days");
    expect(chart.series[1].values).toEqual([5, 0, 0, 0, 0, 0, 4]);
  });

  it("draws picked sources side by side, ignoring the source filter", () => {
    const chart = buildChart(
      data,
      opts({ compare: "sources", source: "direct", picked: ["s:tiktok", "r:Instagram"] }),
      labels,
    );
    expect(chart.series.map((s) => [s.label, s.kind])).toEqual([
      ["S:TIKTOK", "part"],
      ["R:INSTAGRAM", "part"],
    ]);
    expect(chart.series[0].values.at(-1)).toBe(3);
    expect(chart.series[1].values.at(-2)).toBe(2);
    expect(chart.total).toBe(6);
  });

  it("filters clicks by link and compares links", () => {
    expect(buildChart(data, opts({ metric: "clicks", link: "l1" }), labels).total).toBe(2);
    const chart = buildChart(
      data,
      opts({ metric: "clicks", compare: "links", link: "l1", picked: ["l1", "l2"] }),
      labels,
    );
    expect(chart.series.map((s) => s.label)).toEqual(["Shop", "Deleted link"]);
    expect(chart.series[1].values.at(-3)).toBe(1);
    expect(chart.total).toBe(3);
  });

  it("can't compare links for views", () => {
    const chart = buildChart(data, opts({ compare: "links", picked: ["l1"] }), labels);
    expect(chart.series.map((s) => s.key)).toEqual(["main"]);
  });

  it("draws at most four lines", () => {
    const chart = buildChart(
      data,
      opts({ compare: "sources", picked: ["a", "b", "c", "d", "e"] }),
      labels,
    );
    expect(chart.series).toHaveLength(4);
  });
});

describe("ranked", () => {
  it("orders channels and links by total", () => {
    expect(ranked(data, "views", "channel", 7)).toEqual([
      { key: "s:tiktok", count: 4 },
      { key: "r:Instagram", count: 2 },
    ]);
    expect(ranked(data, "clicks", "link").map((r) => r.key)).toEqual(["l1", "l2"]);
  });
});

describe("change", () => {
  it.each([
    [12, 10, "+20%"],
    [5, 10, "-50%"],
    [10, 10, "0%"],
    [3, 0, "New"],
    [0, 0, null],
  ])("%s vs %s is %s", (now, before, out) => {
    expect(change(now, before)).toBe(out);
  });
});

describe("niceScale", () => {
  it.each([
    [0, 4],
    [3, 4],
    [7, 8],
    [9, 10],
    [37, 40],
    [130, 200],
    [999, 1000],
  ])("max %s tops out at %s", (max, top) => {
    const scale = niceScale(max);
    expect(scale.top).toBe(top);
    expect(scale.ticks).toHaveLength(5);
    expect(scale.top).toBeGreaterThanOrEqual(max);
  });
});

describe("compactNumber", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1000, "1k"],
    [1971, "1.9k"],
    [12_345, "12k"],
    [999_999, "999k"],
    [1_250_000, "1.2M"],
    [42_000_000, "42M"],
  ])("%s is %s", (n, out) => {
    expect(compactNumber(n)).toBe(out);
  });
});
