import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// A stable, anonymous id for a visitor: a keyed hash of their IP address,
// so the raw IP is never stored.
export function visitorId(headers: Headers): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "biolyn";
  return createHmac("sha256", secret)
    .update(ip)
    .digest("base64url")
    .slice(0, 22);
}

// Counts one hit for `key` and returns false once it goes over `limit`
// within `windowSeconds`. If the check itself fails, it lets the request
// through so visitors never get stuck.
export async function allow(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return true;
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data !== false;
}
