// Scheduled links: a link shows only between starts_at and ends_at.
export type Scheduled = { starts_at: string | null; ends_at: string | null };

export function isLive(link: Scheduled, now: number): boolean {
  if (link.starts_at && Date.parse(link.starts_at) > now) return false;
  if (link.ends_at && Date.parse(link.ends_at) <= now) return false;
  return true;
}

// Seconds until the next time any link appears or disappears, or null
// when nothing is scheduled ahead.
export function secondsUntilNextChange(
  links: Scheduled[],
  now: number,
): number | null {
  let next = Infinity;
  for (const l of links) {
    for (const t of [l.starts_at, l.ends_at]) {
      const ms = t ? Date.parse(t) : NaN;
      if (ms > now && ms < next) next = ms;
    }
  }
  return next === Infinity ? null : Math.ceil((next - now) / 1000);
}
