import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getPublicProfile } from "@/lib/profiles";
import {
  CARD_SIZE,
  cardPalette,
  cardStyleFrom,
  displayUrl,
  initial,
  nameFontSize,
  qrSvg,
  svgDataUrl,
} from "@/lib/qr-card";
import { cleanSource, sourceUrl } from "@/lib/sources";

const fontDir = join(process.cwd(), "src/assets/fonts");
const fonts = Promise.all([
  readFile(join(fontDir, "Unbounded-ExtraBold.ttf")),
  readFile(join(fontDir, "IBMPlexSans-Regular.ttf")),
  readFile(join(fontDir, "IBMPlexSans-SemiBold.ttf")),
]);

// The profile picture as a data URL, so a slow or missing picture
// shows the first letter instead of breaking the whole card.
async function picture(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpe?g|webp|gif)/.test(type)) return null;
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${data}`;
  } catch {
    return null;
  }
}

// The share card picture: QR code, name and page address.
// ?style=brand|night|page picks the colors, ?s=<code> points the QR code
// at a tracking link, and ?download=1 saves it as a file.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/qr-card/[username]">,
) {
  const { username } = await ctx.params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) return new Response("Not found", { status: 404 });

  const params = request.nextUrl.searchParams;
  const style = cardStyleFrom(params.get("style"));
  const code = cleanSource(params.get("s"));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://biolyn.link";
  const pageUrl = `${siteUrl}/${profile.username}`;
  const qrUrl = code ? sourceUrl(siteUrl, profile.username, code) : pageUrl;

  const p = cardPalette(style, profile.theme);
  const name = profile.display_name?.trim() || profile.username;
  const [[display, body, bodyBold], avatar] = await Promise.all([
    fonts,
    picture(profile.avatar_url),
  ]);
  const qr = svgDataUrl(qrSvg(qrUrl, p));

  const headers: Record<string, string> = {
    "Cache-Control": "public, max-age=300, s-maxage=3600",
  };
  if (params.get("download")) {
    const file = `${profile.username}${code ? `-${code}` : ""}-biolyn.png`;
    headers["Content-Disposition"] = `attachment; filename="${file}"`;
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "88px 80px 80px",
        background: p.background,
        color: p.text,
        fontFamily: "Plex",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 176,
            height: 176,
            borderRadius: 88,
            border: `6px solid ${p.accent}`,
            padding: 6,
          }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={152}
              height={152}
              style={{ borderRadius: 76, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 152,
                height: 152,
                borderRadius: 76,
                alignItems: "center",
                justifyContent: "center",
                background: p.accent,
                color: p.background.startsWith("#") ? p.background : "#171717",
                fontFamily: "Unbounded",
                fontSize: 72,
              }}
            >
              {initial(name)}
            </div>
          )}
        </div>
        <div
          style={{
            marginTop: 36,
            maxWidth: 900,
            textAlign: "center",
            fontFamily: "Unbounded",
            fontSize: nameFontSize(name),
            lineHeight: 1.1,
          }}
        >
          {name}
        </div>
        {name !== profile.username && (
          <div style={{ marginTop: 14, fontSize: 36, color: p.muted }}>
            {`@${profile.username}`}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          padding: 40,
          borderRadius: 56,
          background: p.tile,
          border: `3px solid ${p.tileBorder}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="" width={500} height={500} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 34, color: p.muted }}>
          Scan to open my page
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 44,
            fontWeight: 600,
            color: p.accent,
          }}
        >
          {displayUrl(pageUrl)}
        </div>
      </div>
    </div>,
    {
      ...CARD_SIZE,
      headers,
      fonts: [
        { name: "Unbounded", data: display, weight: 800, style: "normal" },
        { name: "Plex", data: body, weight: 400, style: "normal" },
        { name: "Plex", data: bodyBold, weight: 600, style: "normal" },
      ],
    },
  );
}
