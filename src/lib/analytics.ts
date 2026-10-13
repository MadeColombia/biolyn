import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const DAY = 24 * 60 * 60 * 1000;

export type Stats = {
  views7: number;
  views30: number;
  clicks30: number;
  clicksByLink: Record<string, number>;
  topReferrers: { host: string; count: number }[];
};

// Reads the last 30 days of views and clicks for the signed-in owner
// (Row Level Security limits rows to their own) and counts them here.
// Fine for small pages; move the counting into SQL once pages get busy.
export async function getStats(
  supabase: SupabaseClient,
  profileId: string,
  linkIds: string[],
): Promise<Stats> {
  const now = Date.now();
  const since = new Date(now - 30 * DAY).toISOString();

  const [{ data: views }, { data: clicks }] = await Promise.all([
    supabase
      .from("views")
      .select("referrer, created_at")
      .eq("profile_id", profileId)
      .gte("created_at", since)
      .limit(10000),
    linkIds.length
      ? supabase
          .from("clicks")
          .select("link_id")
          .in("link_id", linkIds)
          .gte("created_at", since)
          .limit(10000)
      : Promise.resolve({ data: [] as { link_id: string }[] }),
  ]);

  const weekAgo = now - 7 * DAY;
  const referrers = new Map<string, number>();
  let views7 = 0;
  for (const v of views ?? []) {
    if (new Date(v.created_at).getTime() >= weekAgo) views7++;
    const host = v.referrer ?? "Direct or unknown";
    referrers.set(host, (referrers.get(host) ?? 0) + 1);
  }

  const clicksByLink: Record<string, number> = {};
  for (const c of clicks ?? []) {
    clicksByLink[c.link_id] = (clicksByLink[c.link_id] ?? 0) + 1;
  }

  return {
    views7,
    views30: views?.length ?? 0,
    clicks30: clicks?.length ?? 0,
    clicksByLink,
    topReferrers: [...referrers]
      .map(([host, count]) => ({ host, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
