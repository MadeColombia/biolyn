import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { allow, visitorId } from "@/lib/rate-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keeps only the site name ("l.instagram.com"), never the full URL,
// and drops visits that came from Biolyn itself.
function referrerHost(raw: unknown, ownHost: string): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return host && host !== ownHost ? host : null;
  } catch {
    return null;
  }
}

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
  });
  return new NextResponse(null, { status: 204 });
}
