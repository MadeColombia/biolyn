import "server-only";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { channelKey } from "./sources";
import { addDays, type Analytics, type DailyRow } from "./chart";

/** Days of history the dashboard loads: 90 shown + 90 to compare with. */
export const HISTORY_DAYS = 180;

type RawRow = {
  d: string;
  k: "v" | "c";
  l: string | null;
  s: string | null;
  r: string | null;
  n: number;
};

/**
 * Loads views and clicks per day for the signed-in owner. The counting
 * happens in the database (analytics_daily), and Row Level Security keeps
 * it to the owner's own rows.
 */
export async function getAnalytics(
  supabase: SupabaseClient,
  profileId: string,
): Promise<Analytics> {
  // Reading the clock needs a real request; cookies alone don't count,
  // because Next.js can prerender with them ahead of time.
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  const since = addDays(today, -(HISTORY_DAYS - 1));

  const { data, error } = await supabase.rpc("analytics_daily", {
    p_profile_id: profileId,
    p_since: `${since}T00:00:00Z`,
  });
  if (error || !Array.isArray(data)) return { today, rows: [] };

  // Old rows can land in the same channel (two spellings of one site),
  // so add them up again.
  const merged = new Map<string, DailyRow>();
  for (const raw of data as RawRow[]) {
    const kind = raw.k === "c" ? "click" : "view";
    const channel = channelKey(raw.s, raw.r);
    const link = kind === "click" ? raw.l : null;
    const id = `${raw.d}|${kind}|${link}|${channel}`;
    const row = merged.get(id);
    if (row) row.count += Number(raw.n) || 0;
    else
      merged.set(id, {
        day: raw.d,
        kind,
        link,
        channel,
        count: Number(raw.n) || 0,
      });
  }
  return { today, rows: [...merged.values()] };
}

export type Stats = {
  views7: number;
  views30: number;
  clicks30: number;
  clicksByLink: Record<string, number>;
  /** Views in the last 30 days per channel key, biggest first, top 5. */
  topChannels: { key: string; count: number }[];
};

/** The headline numbers under the chart. */
export function summarize({ today, rows }: Analytics): Stats {
  const week = addDays(today, -6);
  const month = addDays(today, -29);
  const stats: Stats = {
    views7: 0,
    views30: 0,
    clicks30: 0,
    clicksByLink: {},
    topChannels: [],
  };
  const channels = new Map<string, number>();
  for (const r of rows) {
    if (r.day < month || r.day > today) continue;
    if (r.kind === "view") {
      stats.views30 += r.count;
      if (r.day >= week) stats.views7 += r.count;
      channels.set(r.channel, (channels.get(r.channel) ?? 0) + r.count);
    } else {
      stats.clicks30 += r.count;
      if (r.link) {
        stats.clicksByLink[r.link] =
          (stats.clicksByLink[r.link] ?? 0) + r.count;
      }
    }
  }
  stats.topChannels = [...channels]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return stats;
}
