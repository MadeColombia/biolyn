import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

// Every link on a public page points here. We log the click, then
// redirect the visitor to the real URL.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/click/[linkId]">,
) {
  const { linkId } = await ctx.params;
  const supabase = createPublicClient();

  const { data: link } = await supabase
    .from("links")
    .select("url")
    .eq("id", linkId)
    .eq("is_visible", true)
    .maybeSingle();

  if (!link) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  await supabase.rpc("log_click", {
    p_link_id: linkId,
    p_referrer: request.headers.get("referer"),
  });

  return NextResponse.redirect(link.url, 302);
}
