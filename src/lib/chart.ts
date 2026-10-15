// Turns daily view and click counts into the lines the analytics chart
// draws, based on the filters the owner picks. Runs in the browser, so
// changing a filter redraws at once without asking the server.

export type DailyRow = {
  /** UTC date, "2026-10-15". */
  day: string;
  kind: "view" | "click";
  /** The link that was clicked (clicks only). */
  link: string | null;
  /** Where the visitor came from, see channelKey() in sources.ts. */
  channel: string;
  count: number;
};

export type Analytics = { today: string; rows: DailyRow[] };

export type Metric = "views" | "clicks";
export type Range = 7 | 30 | 90;
export type Compare = "none" | "previous" | "sources" | "links";

export const RANGES: Range[] = [7, 30, 90];
/** Lines drawn side by side at most, one per chart color. */
export const MAX_LINES = 4;
export const ALL = "all";

export type ChartOptions = {
  metric: Metric;
  range: Range;
  /** Channel key, or ALL. Ignored when comparing sources. */
  source: string;
  /** Link id, or ALL. Clicks only; ignored when comparing links. */
  link: string;
  compare: Compare;
  /** Channel keys or link ids to draw when comparing sources or links. */
  picked: string[];
};

export type Series = {
  key: string;
  label: string;
  values: number[];
  /** "previous" is the same filters, one period earlier. */
  kind: "main" | "previous" | "part";
};

export type Chart = {
  days: string[];
  series: Series[];
  /** Everything matching the filters in the chosen range. */
  total: number;
  /** The same, one period earlier. */
  previousTotal: number;
};

export type Labels = {
  channel: (key: string) => string;
  links: Record<string, string>;
};

/** "2026-10-15" plus n days (n can be negative). */
export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** The `range` days ending on `end`, oldest first. */
export function dayList(end: string, range: number): string[] {
  return Array.from({ length: range }, (_, i) => addDays(end, i - range + 1));
}

/** Whether a chart choice is valid; anything else falls back to defaults. */
export function isRange(n: unknown): n is Range {
  return RANGES.includes(n as Range);
}

function kindOf(metric: Metric) {
  return metric === "clicks" ? "click" : "view";
}

/** Totals per channel or link over the last `range` days, biggest first. */
export function ranked(
  { today, rows }: Analytics,
  metric: Metric,
  by: "channel" | "link",
  range: number = 90,
): { key: string; count: number }[] {
  const from = addDays(today, -(range - 1));
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== kindOf(metric) || r.day < from || r.day > today) continue;
    const key = by === "channel" ? r.channel : r.link;
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + r.count);
  }
  return [...totals]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Builds the lines for the chosen filters. */
export function buildChart(
  data: Analytics,
  opts: ChartOptions,
  labels: Labels,
): Chart {
  const metric = opts.metric;
  const compare =
    opts.compare === "links" && metric !== "clicks" ? "none" : opts.compare;
  const days = dayList(data.today, opts.range);
  const prevDays = dayList(addDays(data.today, -opts.range), opts.range);
  const index = new Map(days.map((d, i) => [d, i]));
  const prevIndex = new Map(prevDays.map((d, i) => [d, i]));

  const useSource = compare !== "sources" && opts.source !== ALL;
  const useLink =
    metric === "clicks" && compare !== "links" && opts.link !== ALL;
  const picked = opts.picked.slice(0, MAX_LINES);

  const main = new Array<number>(opts.range).fill(0);
  const prev = new Array<number>(opts.range).fill(0);
  const parts = picked.map(() => new Array<number>(opts.range).fill(0));
  let total = 0;
  let previousTotal = 0;

  for (const r of data.rows) {
    if (r.kind !== kindOf(metric)) continue;
    if (useSource && r.channel !== opts.source) continue;
    if (useLink && r.link !== opts.link) continue;
    const i = index.get(r.day);
    if (i !== undefined) {
      main[i] += r.count;
      total += r.count;
      const partKey = compare === "sources" ? r.channel : r.link;
      const p = partKey === null ? -1 : picked.indexOf(partKey);
      if (p >= 0) parts[p][i] += r.count;
    }
    const j = prevIndex.get(r.day);
    if (j !== undefined) {
      prev[j] += r.count;
      previousTotal += r.count;
    }
  }

  const name = metric === "clicks" ? "Clicks" : "Views";
  let series: Series[];
  if (compare === "sources" || compare === "links") {
    series = picked.map((key, p) => ({
      key,
      label:
        compare === "sources"
          ? labels.channel(key)
          : (labels.links[key] ?? "Deleted link"),
      values: parts[p],
      kind: "part",
    }));
  } else {
    series = [{ key: "main", label: name, values: main, kind: "main" }];
    if (compare === "previous") {
      series.push({
        key: "previous",
        label: `Previous ${opts.range} days`,
        values: prev,
        kind: "previous",
      });
    }
  }
  return { days, series, total, previousTotal };
}

/** "+25%", "-10%", "New" or null when there is nothing to compare. */
export function change(total: number, previous: number): string | null {
  if (previous === 0) return total > 0 ? "New" : null;
  const pct = Math.round(((total - previous) / previous) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/** A round number just above the biggest value, and 4 steps up to it. */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 4) {
    const top = 4;
    return { top, ticks: [0, 1, 2, 3, 4] };
  }
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ??
    10 * pow;
  const top = step * 4;
  return { top, ticks: [0, step, step * 2, step * 3, top] };
}

/** "Oct 15" for axis labels and tooltips. */
export function shortDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
