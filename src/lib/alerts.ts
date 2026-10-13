import "server-only";
import { createHash } from "node:crypto";
import { allow } from "@/lib/rate-limit";

// Emails a short alert through Resend when a server error happens.
// Needs RESEND_API_KEY and ALERT_EMAIL; does nothing without them.
// The same error is emailed at most once every 30 minutes, and at most
// 20 alerts go out per hour in total.
export async function sendErrorAlert(details: {
  message: string;
  digest?: string;
  path: string;
  method: string;
  routePath: string;
  routeType: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) return;

  const fingerprint = createHash("sha256")
    .update(details.digest ?? `${details.routePath}:${details.message}`)
    .digest("hex")
    .slice(0, 16);
  if (!(await allow(`alert:${fingerprint}`, 1, 1800))) return;
  if (!(await allow("alert:all", 20, 3600))) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      from: "Biolyn alerts <alerts@biolyn.link>",
      to,
      subject: `Biolyn error on ${details.routePath}`,
      text: [
        `Something failed on biolyn.link.`,
        ``,
        `Request: ${details.method} ${details.path}`,
        `Route: ${details.routePath} (${details.routeType})`,
        `Error: ${details.message}`,
        details.digest ? `Digest: ${details.digest}` : "",
        ``,
        `Details are in Vercel > biolyn > Logs. Repeats of this error are muted for 30 minutes.`,
      ].join("\n"),
    }),
  }).catch(() => {});
}
