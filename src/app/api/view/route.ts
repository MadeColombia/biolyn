import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

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

  const ownHost = request.nextUrl.hostname.replace(/^www\./, "");
  await createPublicClient().rpc("log_view", {
    p_profile_id: profileId,
    p_referrer: referrerHost(body.referrer, ownHost),
  });
  return new NextResponse(null, { status: 204 });
}
