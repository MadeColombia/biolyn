import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { allow, visitorId } from "@/lib/rate-limit";

// Every link on a public page points here. We log the click, then
// redirect the visitor to the real URL.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/click/[linkId]">,
) {
  const { linkId } = await ctx.params;

  // Read fresh (not cached) so a suspended page stops redirecting at once.
  const { data: link } = await createPublicClient()
    .from("links")
    .select("url, profiles!inner(is_suspended)")
    .eq("id", linkId)
    .eq("is_visible", true)
    .eq("profiles.is_suspended", false)
    .maybeSingle();

  if (!link) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Past 60 clicks a minute from one visitor, still redirect but stop counting.
  if (await allow(`click:${visitorId(request.headers)}`, 60, 60)) {
    const db = createAdminClient() ?? createPublicClient();
    await db.rpc("log_click", {
      p_link_id: linkId,
      p_referrer: request.headers.get("referer"),
    });
  }

  return NextResponse.redirect(link.url, 302);
}
