import "server-only";
import { createHash } from "node:crypto";
import { renderEmail, renderText, type EmailContent } from "@/lib/email/layout";
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

  const email: EmailContent = {
    lang: "en",
    subject: `biolyn error on ${details.routePath}`,
    preview: details.message,
    heading: "Something failed",
    paragraphs: ["A page or action on biolyn.link hit a server error."],
    details: [
      ["Request", `${details.method} ${details.path}`],
      ["Route", `${details.routePath} (${details.routeType})`],
      ["Error", details.message],
      ...(details.digest ? [["Digest", details.digest] as [string, string]] : []),
    ],
    button: { label: "Open Vercel logs", url: "https://vercel.com/madecolombias-projects/biolyn/logs" },
    note: "Repeats of this error are muted for 30 minutes.",
    footer: "You get these alerts because ALERT_EMAIL is set in Vercel.",
  };

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      from: "biolyn alerts <alerts@biolyn.link>",
      to,
      subject: email.subject,
      html: renderEmail(email),
      text: renderText(email),
    }),
  }).catch(() => {});
}
