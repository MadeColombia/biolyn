import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { allow, visitorId } from "@/lib/rate-limit";
import { isLive } from "@/lib/schedule";
import { cleanHost, cleanSource, sourceFromSearch } from "@/lib/sources";

// Every link on a public page points here. We log the click, then
// redirect the visitor to the real URL.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/click/[linkId]">,
) {
  const { linkId } = await ctx.params;
  // The public page adds where its visitor came from: ?s=<source code>
  // and ?r=<site name>. See ViewTracker.
  const params = request.nextUrl.searchParams;

  // Read fresh (not cached) so a suspended page or an ended scheduled link
  // stops redirecting at once.
  const { data: link } = await createPublicClient()
    .from("links")
    .select("url, starts_at, ends_at, profiles!inner(is_suspended)")
    .eq("id", linkId)
    .eq("is_visible", true)
    .eq("profiles.is_suspended", false)
    .maybeSingle();

  if (!link?.url || !isLive(link, Date.now())) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Past 60 clicks a minute from one visitor, still redirect but stop counting.
  if (await allow(`click:${visitorId(request.headers)}`, 60, 60)) {
    const db = createAdminClient() ?? createPublicClient();
    await db.rpc("log_click", {
      p_link_id: linkId,
      p_referrer: cleanHost(params.get("r")),
      p_source: cleanSource(params.get("s")) ?? sourceFromReferer(request),
    });
  }

  return NextResponse.redirect(link.url, 302);
}

// Without JavaScript the link has no ?s=, but the browser still says
// which page the click came from, and that address can carry the tag.
function sourceFromReferer(request: NextRequest): string | null {
  try {
    const url = new URL(request.headers.get("referer") ?? "");
    return url.host === request.nextUrl.host
      ? sourceFromSearch(url.searchParams)
      : null;
  } catch {
    return null;
  }
}
