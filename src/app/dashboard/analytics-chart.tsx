"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heading, cx, input } from "@/components/ui";
import {
  ALL,
  MAX_LINES,
  RANGES,
  buildChart,
  change,
  compactNumber,
  niceScale,
  ranked,
  shortDate,
  type Analytics,
  type Compare,
  type Metric,
  type Range,
  type Series,
} from "@/lib/chart";
import { channelLabel } from "@/lib/sources";

// Written out in full so Tailwind finds them. A line keeps its slot (and
// color) while other lines are added or removed.
const STROKE = [
  "stroke-chart-1",
  "stroke-chart-2",
  "stroke-chart-3",
  "stroke-chart-4",
];
const FILL = ["fill-chart-1", "fill-chart-2", "fill-chart-3", "fill-chart-4"];
const SWATCH = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"];

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 40 };

type Link = { id: string; title: string };

/** A row of buttons where exactly one is on, like iOS segmented controls. */
function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-xl bg-raised p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-9 rounded-lg px-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            o.value === value
              ? "bg-surface text-ink"
              : "text-ink-soft hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm font-bold text-ink">
      {label}
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={input({ select: true })}
        >
          {children}
        </select>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}

const MODE_KEY = "biolyn:analytics-mode";

/**
 * The Analytics card with a Simple / Pro switch. Simple is the totals
 * and lists (`children`); Pro adds the chart with filters above them.
 * The choice is remembered in this browser.
 */
export function AnalyticsModes({
  data,
  sourceNames,
  links,
  children,
}: {
  data: Analytics;
  sourceNames: Record<string, string>;
  links: Link[];
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<"simple" | "pro">("simple");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read after hydration so server and browser HTML match
      if (localStorage.getItem(MODE_KEY) === "pro") setMode("pro");
    } catch {
      // Storage blocked (private mode): stay on Simple.
    }
  }, []);
  function pick(next: "simple" | "pro") {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {}
  }
  const pro = mode === "pro";
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Heading size="section">Analytics</Heading>
          <p className="text-sm text-ink-muted">
            {pro
              ? "Pick what to see and compare."
              : "Who visits your page and what they tap."}
          </p>
        </div>
        <Segmented
          label="Analytics view"
          value={mode}
          onChange={pick}
          options={[
            { value: "simple", label: "Simple" },
            { value: "pro", label: "Pro" },
          ]}
        />
      </div>
      {pro && (
        <AnalyticsChart data={data} sourceNames={sourceNames} links={links} />
      )}
      <div
        className={cx(
          "flex flex-col gap-6",
          pro && "border-t border-line pt-6",
        )}
      >
        {children}
      </div>
    </>
  );
}

/** Measures an element's width, so the chart can draw at real pixels. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.round(entry.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function AnalyticsChart({
  data,
  sourceNames,
  links,
}: {
  data: Analytics;
  /** Source code to the name the owner gave it. */
  sourceNames: Record<string, string>;
  links: Link[];
}) {
  const [metric, setMetric] = useState<Metric>("views");
  const [range, setRange] = useState<Range>(30);
  const [source, setSource] = useState(ALL);
  const [link, setLink] = useState(ALL);
  const [compare, setCompare] = useState<Compare>("none");
  // Up to four lines when comparing; an empty slot keeps the others'
  // colors from moving.
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [showTable, setShowTable] = useState(false);

  const linkNames = useMemo(
    () => Object.fromEntries(links.map((l) => [l.id, l.title])),
    [links],
  );
  const labelOf = (key: string) => channelLabel(key, sourceNames);

  // Every place visitors came from in the last 90 days, plus the owner's
  // own tracking links even before anyone used them.
  const channels = useMemo(() => {
    const seen = ranked(data, metric, "channel").map((r) => r.key);
    const named = Object.keys(sourceNames).map((code) => `s:${code}`);
    return [...seen, ...named.filter((k) => !seen.includes(k))];
  }, [data, metric, sourceNames]);

  const linkOptions = useMemo(() => {
    const busy = ranked(data, "clicks", "link").map((r) => r.key);
    return [
      ...busy.filter((id) => linkNames[id]),
      ...links.map((l) => l.id).filter((id) => !busy.includes(id)),
    ];
  }, [data, links, linkNames]);

  const picked = slots.filter((s): s is string => s !== null);
  const chart = buildChart(
    data,
    { metric, range, source, link, compare, picked },
    { channel: labelOf, links: linkNames },
  );
  const slotOf = (key: string) => Math.max(0, slots.indexOf(key));

  function pickCompare(next: Compare) {
    setCompare(next);
    if (next === "sources") setSlots(channels.slice(0, 3));
    if (next === "links") setSlots(linkOptions.slice(0, 3));
  }

  function pickMetric(next: Metric) {
    setMetric(next);
    if (next === "views") {
      setLink(ALL);
      if (compare === "links") setCompare("none");
    }
  }

  function toggle(key: string) {
    setSlots((current) => {
      const at = current.indexOf(key);
      if (at >= 0) {
        const copy = [...current];
        copy[at] = null;
        return copy;
      }
      const free = current.indexOf(null);
      if (free >= 0) {
        const copy = [...current];
        copy[free] = key;
        return copy;
      }
      return current.length < MAX_LINES ? [...current, key] : current;
    });
  }

  const delta = change(chart.total, chart.previousTotal);
  const options = compare === "sources" ? channels : linkOptions;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Show"
          value={metric}
          onChange={pickMetric}
          options={[
            { value: "views", label: "Views" },
            { value: "clicks", label: "Clicks" },
          ]}
        />
        <Segmented
          label="Time range"
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ value: r, label: `${r} days` }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {compare !== "sources" && (
          <Select label="Source" value={source} onChange={setSource}>
            <option value={ALL}>All sources</option>
            {channels.map((key) => (
              <option key={key} value={key}>
                {labelOf(key)}
              </option>
            ))}
          </Select>
        )}
        {metric === "clicks" && compare !== "links" && (
          <Select label="Link" value={link} onChange={setLink}>
            <option value={ALL}>All links</option>
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </Select>
        )}
        <Select
          label="Compare with"
          value={compare}
          onChange={(v) => pickCompare(v as Compare)}
        >
          <option value="none">Nothing</option>
          <option value="previous">Previous {range} days</option>
          <option value="sources">Sources side by side</option>
          {metric === "clicks" && (
            <option value="links">Links side by side</option>
          )}
        </Select>
      </div>

      {(compare === "sources" || compare === "links") && (
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-bold text-ink">
            Pick up to {MAX_LINES} {compare === "sources" ? "sources" : "links"}
          </legend>
          {options.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing to compare yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.map((key) => {
                const on = slots.includes(key);
                const full = !on && picked.length >= MAX_LINES;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    disabled={full}
                    onClick={() => toggle(key)}
                    className={cx(
                      "inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40",
                      on
                        ? "border-ink-muted bg-surface font-bold text-ink"
                        : "border-edge text-ink-soft hover:border-ink-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cx(
                        "h-0.5 w-3 shrink-0 rounded-full",
                        on ? SWATCH[slotOf(key)] : "bg-edge",
                      )}
                    />
                    <span className="truncate">
                      {compare === "sources" ? labelOf(key) : linkNames[key]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Heading as="p" size="title" className="tabular-nums">
          {chart.total.toLocaleString("en-US")}
        </Heading>
        <p className="text-sm text-ink-muted">
          {metric === "clicks" ? "clicks" : "views"} in the last {range} days
          {delta && (
            <>
              {", "}
              <span className="font-bold text-ink">{delta}</span> vs the {range}{" "}
              days before
            </>
          )}
        </p>
      </div>

      {chart.series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {chart.series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <LineKey series={s} slot={slotOf(s.key)} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <LineChart
        days={chart.days}
        series={chart.series}
        slotOf={slotOf}
        noun={metric === "clicks" ? "clicks" : "views"}
      />

      <div>
        <button
          type="button"
          aria-expanded={showTable}
          onClick={() => setShowTable((v) => !v)}
          className="min-h-11 rounded-xl px-1 text-sm font-bold text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {showTable ? "Hide numbers" : "Show numbers as a table"}
        </button>
        {showTable && <ChartTable days={chart.days} series={chart.series} />}
      </div>
    </div>
  );
}

/** A short stroke in the line's color, dashed for the previous period. */
function LineKey({ series, slot }: { series: Series; slot: number }) {
  return (
    <svg width="16" height="4" aria-hidden className="shrink-0">
      <line
        x1="1"
        x2="15"
        y1="2"
        y2="2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={series.kind === "previous" ? "3 3" : undefined}
        className={
          series.kind === "previous"
            ? "stroke-ink-muted"
            : STROKE[series.kind === "main" ? 0 : slot]
        }
      />
    </svg>
  );
}

function strokeClass(s: Series, slotOf: (key: string) => number) {
  if (s.kind === "previous") return "stroke-ink-muted";
  return STROKE[s.kind === "main" ? 0 : slotOf(s.key)];
}

function LineChart({
  days,
  series,
  slotOf,
  noun,
}: {
  days: string[];
  series: Series[];
  slotOf: (key: string) => number;
  noun: string;
}) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const { top, ticks } = niceScale(max);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = days.length > 1 ? plotW / (days.length - 1) : 0;
  const x = (i: number) => PAD.left + i * step;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  // Roughly one date label per 80px, always including the last day.
  const every = Math.max(1, Math.ceil(days.length / Math.max(2, plotW / 80)));
  const labelled = days
    .map((_, i) => i)
    .filter((i) => (days.length - 1 - i) % every === 0);

  function indexAt(clientX: number, rect: DOMRect) {
    const i = Math.round((clientX - rect.left - PAD.left) / (step || 1));
    return Math.min(days.length - 1, Math.max(0, i));
  }

  const empty = max === 0;
  const tipLeft = hover === null ? 0 : x(hover);

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        tabIndex={0}
        aria-label={`Line chart of ${noun} per day from ${shortDate(days[0])} to ${shortDate(days[days.length - 1])}. Use the left and right arrow keys to read each day, or show the numbers as a table.`}
        className="block touch-pan-y rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        onPointerMove={(e) =>
          setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))
        }
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const d = e.key === "ArrowLeft" ? -1 : 1;
            setHover((h) =>
              Math.min(
                days.length - 1,
                Math.max(0, (h ?? days.length - 1) + (h === null ? 0 : d)),
              ),
            );
          }
        }}
      >
        {/* Grid: quiet lines at each round number. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className="stroke-line"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-ink-muted text-xs tabular-nums"
            >
              {compactNumber(t)}
            </text>
          </g>
        ))}
        {labelled.map((i) => (
          <text
            key={days[i]}
            x={x(i)}
            y={HEIGHT - 8}
            textAnchor={
              i === days.length - 1 ? "end" : i === 0 ? "start" : "middle"
            }
            className="fill-ink-muted text-xs"
          >
            {shortDate(days[i])}
          </text>
        ))}

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="stroke-ink-muted"
            strokeWidth="1"
          />
        )}

        {/* The previous period sits behind the current lines. */}
        {[...series]
          .sort((a, b) =>
            a.kind === "previous" ? -1 : b.kind === "previous" ? 1 : 0,
          )
          .map((s) => (
            <path
              key={s.key}
              d={s.values
                .map(
                  (v, i) =>
                    `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
                )
                .join("")}
              fill="none"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.kind === "previous" ? "4 4" : undefined}
              className={strokeClass(s, slotOf)}
            />
          ))}

        {hover !== null &&
          series.map((s) => (
            <circle
              key={s.key}
              cx={x(hover)}
              cy={y(s.values[hover])}
              r="4.5"
              strokeWidth="2"
              className={cx(
                "stroke-surface",
                s.kind === "previous"
                  ? "fill-ink-muted"
                  : FILL[s.kind === "main" ? 0 : slotOf(s.key)],
              )}
            />
          ))}

        {empty && (
          <text
            x={PAD.left + plotW / 2}
            y={PAD.top + plotH / 2}
            textAnchor="middle"
            className="fill-ink-muted text-sm"
          >
            No {noun} in this range yet
          </text>
        )}
      </svg>

      {hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 flex max-w-56 min-w-36 flex-col gap-1 rounded-xl border border-edge bg-surface px-3 py-2 text-sm shadow-sm"
          // Beside the crosshair, on whichever side has more room.
          style={
            tipLeft < width / 2
              ? { top: PAD.top, left: tipLeft + 12 }
              : { top: PAD.top, right: width - tipLeft + 12 }
          }
        >
          <p className="text-xs text-ink-muted">
            {shortDate(days[hover])}
            {series.some((s) => s.kind === "previous") &&
              ` vs ${shortDate(shiftBack(days, hover))}`}
          </p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-2">
              <LineKey series={s} slot={slotOf(s.key)} />
              <span className="font-bold tabular-nums text-ink">
                {s.values[hover].toLocaleString("en-US")}
              </span>
              <span className="truncate text-ink-soft">{s.label}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** The matching day in the previous period. */
function shiftBack(days: string[], i: number) {
  const t = Date.parse(`${days[i]}T00:00:00Z`) - days.length * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function ChartTable({ days, series }: { days: string[]; series: Series[] }) {
  return (
    <div className="mt-2 max-h-80 overflow-auto rounded-2xl border border-edge">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface text-left">
          <tr className="border-b border-line">
            <th scope="col" className="px-3 py-2 font-bold">
              Day
            </th>
            {series.map((s) => (
              <th
                key={s.key}
                scope="col"
                className="px-3 py-2 text-right font-bold"
              >
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {days
            .map((d, i) => ({ d, i }))
            .reverse()
            .map(({ d, i }) => (
              <tr key={d}>
                <th
                  scope="row"
                  className="px-3 py-2 text-left font-normal text-ink-soft"
                >
                  {shortDate(d)}
                </th>
                {series.map((s) => (
                  <td key={s.key} className="px-3 py-2 text-right tabular-nums">
                    {s.values[i]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
