// One look for every email biolyn sends: the sign-in emails Supabase sends
// (templates in supabase/templates, built from auth-templates.ts) and the
// alerts the app sends through Resend. Same colors as globals.css, written
// out as hex because email apps don't read CSS variables.
//
// Email HTML is old-fashioned on purpose: tables for layout, inline styles,
// bgcolor next to background colors, and no images except the hosted logo.
// Apple Mail and iOS Mail also pick up the dark colors and the brand fonts;
// Gmail and Outlook show the light colors and a system font.

export const EMAIL_COLORS = {
  light: {
    canvas: "#f5efe6",
    surface: "#fffbf5",
    edge: "#e3d5c5",
    ink: "#2a1e18",
    inkSoft: "#5e4b40",
    inkMuted: "#74604f",
    brand: "#b9532d",
    onBrand: "#ffffff",
  },
  dark: {
    canvas: "#15110f",
    surface: "#211a17",
    edge: "#3a2e28",
    ink: "#f6eee8",
    inkSoft: "#cdbfb5",
    inkMuted: "#a39185",
    brand: "#d2693f",
    onBrand: "#15110f",
  },
} as const;

/** The tile mark, already live on biolyn.link (see docs/design-system.md). */
export const EMAIL_LOGO_URL = "https://biolyn.link/brand/biolyn-mark-512.png";

const DISPLAY_FONT =
  "'Unbounded','Helvetica Neue',Helvetica,Arial,sans-serif";
const BODY_FONT =
  "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type EmailContent = {
  lang: "en" | "es";
  /** Subject line, also the page title. */
  subject: string;
  /** The grey line inbox lists show next to the subject. */
  preview: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Shown under the button for email apps that break buttons. */
  fallback?: string;
  /** Label and value rows, for alerts. */
  details?: [label: string, value: string][];
  /** Small print at the bottom of the card. */
  note?: string;
  /** Under the card: why this email arrived. */
  footer: string;
};

/**
 * Escapes text for HTML. Supabase placeholders like {{ .ConfirmationURL }}
 * pass through untouched because they use none of these characters.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const { light, dark } = EMAIL_COLORS;

// Dark colors for the apps that support prefers-color-scheme (Apple Mail,
// iOS Mail, Outlook for Mac); [data-ogsc] is Outlook.com's dark mode.
const STYLE = `
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%}
a{text-decoration:none}
@media (max-width:600px){
.b-card{padding:28px 24px!important}
.b-title{font-size:24px!important}
.b-btns{width:100%!important}
.b-btn a{display:block!important}
}
@media (prefers-color-scheme:dark){
.b-canvas{background:${dark.canvas}!important}
.b-card{background:${dark.surface}!important;border-color:${dark.edge}!important}
.b-ink{color:${dark.ink}!important}
.b-soft{color:${dark.inkSoft}!important}
.b-muted{color:${dark.inkMuted}!important}
.b-link{color:${dark.brand}!important}
.b-btn{background:${dark.brand}!important}
.b-btn a{color:${dark.onBrand}!important}
.b-rule{border-color:${dark.edge}!important}
}
[data-ogsc] .b-ink{color:${dark.ink}!important}
[data-ogsc] .b-soft{color:${dark.inkSoft}!important}
[data-ogsc] .b-muted{color:${dark.inkMuted}!important}
[data-ogsc] .b-link{color:${dark.brand}!important}
`.trim();

function paragraph(text: string): string {
  return `<p class="b-soft" style="margin:0 0 16px;font-family:${BODY_FONT};font-size:16px;line-height:1.6;color:${light.inkSoft}">${escapeHtml(text)}</p>`;
}

function button({ label, url }: { label: string; url: string }): string {
  return `<table role="presentation" class="b-btns" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px"><tr>
<td class="b-btn" bgcolor="${light.brand}" style="background:${light.brand};border-radius:16px;text-align:center">
<a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:16px 32px;font-family:${BODY_FONT};font-size:16px;line-height:20px;font-weight:700;color:${light.onBrand};text-decoration:none;border-radius:16px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function fallback(text: string, url: string): string {
  return `<p class="b-muted" style="margin:16px 0 0;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${light.inkMuted}">${escapeHtml(text)}<br>
<a class="b-link" href="${escapeHtml(url)}" target="_blank" style="color:${light.brand};word-break:break-all">${escapeHtml(url)}</a></p>`;
}

function details(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) => `<tr>
<td class="b-muted" valign="top" style="padding:8px 16px 8px 0;font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${light.inkMuted};white-space:nowrap">${escapeHtml(label)}</td>
<td class="b-ink" valign="top" style="padding:8px 0;font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${light.ink};word-break:break-word">${escapeHtml(value)}</td>
</tr>`,
    )
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">
${cells}
</table>`;
}

function note(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="b-rule" style="border-top:1px solid ${light.edge};padding-top:20px;margin-top:24px">
<p class="b-muted" style="margin:0;font-family:${BODY_FONT};font-size:14px;line-height:1.5;color:${light.inkMuted}">${escapeHtml(text)}</p>
</td></tr></table>`;
}

/** The full HTML email. */
export function renderEmail(content: EmailContent): string {
  const body = [
    `<h1 class="b-ink b-title" style="margin:0 0 16px;font-family:${DISPLAY_FONT};font-size:28px;line-height:1.2;font-weight:800;color:${light.ink}">${escapeHtml(content.heading)}</h1>`,
    ...content.paragraphs.map(paragraph),
    content.details ? details(content.details) : "",
    content.button ? button(content.button) : "",
    content.button && content.fallback
      ? fallback(content.fallback, content.button.url)
      : "",
    content.note ? `<div style="height:24px;line-height:24px">&nbsp;</div>${note(content.note)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${content.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(content.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;700&family=Unbounded:wght@800&display=swap" rel="stylesheet">
<style>
${STYLE}
</style>
</head>
<body class="b-canvas" style="margin:0;padding:0;background:${light.canvas}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(content.preview)}</div>
<table role="presentation" class="b-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${light.canvas}" style="background:${light.canvas}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 8px 24px">
<a href="https://biolyn.link" target="_blank"><img src="${EMAIL_LOGO_URL}" width="48" height="48" alt="biolyn" style="display:block;width:48px;height:48px;border:0;border-radius:12px"></a>
</td></tr>
<tr><td class="b-card" bgcolor="${light.surface}" style="background:${light.surface};border:1px solid ${light.edge};border-radius:24px;padding:40px 36px">
${body}
</td></tr>
<tr><td style="padding:24px 8px 0">
<p class="b-muted" style="margin:0 0 4px;font-family:${BODY_FONT};font-size:13px;line-height:1.5;color:${light.inkMuted}">${escapeHtml(content.footer)}</p>
<p style="margin:0;font-family:${BODY_FONT};font-size:13px;line-height:1.5"><a class="b-link" href="https://biolyn.link" target="_blank" style="color:${light.brand};font-weight:700">biolyn.link</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** The plain text version of the same email, for apps that skip HTML. */
export function renderText(content: EmailContent): string {
  const lines = [content.heading, "", ...content.paragraphs.flatMap((p) => [p, ""])];
  if (content.details) {
    for (const [label, value] of content.details) lines.push(`${label}: ${value}`);
    lines.push("");
  }
  if (content.button) lines.push(`${content.button.label}: ${content.button.url}`, "");
  if (content.note) lines.push(content.note, "");
  lines.push("--", content.footer, "https://biolyn.link");
  return lines.join("\n");
}
