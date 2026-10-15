import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { allow, visitorId } from "@/lib/rate-limit";
import { cleanSource, referrerHost } from "@/lib/sources";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The public page calls this once per visit from the browser.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const profileId = body?.profileId;
  if (typeof profileId !== "string" || !UUID.test(profileId)) {
    return new NextResponse(null, { status: 400 });
  }

  // Past 60 page views a minute from one visitor, stop counting them.
  if (!(await allow(`view:${visitorId(request.headers)}`, 60, 60))) {
    return new NextResponse(null, { status: 204 });
  }

  const ownHost = request.nextUrl.hostname.replace(/^www\./, "");
  const db = createAdminClient() ?? createPublicClient();
  await db.rpc("log_view", {
    p_profile_id: profileId,
    p_referrer: referrerHost(body.referrer, ownHost),
    // The page reads ?s= or ?utm_source= from its address and sends it.
    p_source: cleanSource(body.source),
  });
  return new NextResponse(null, { status: 204 });
}
