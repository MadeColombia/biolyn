import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { appleConfig, buildPkpass } from "@/lib/apple-pass";
import { passContentFor } from "@/lib/pass-content";
import { pictureDataUrl } from "@/lib/remote-picture";
import { initial } from "@/lib/qr-card";
import { passLook } from "@/lib/wallet";

const brand = join(process.cwd(), "public/brand");
const svgUrl = (svg: Buffer) =>
  `data:image/svg+xml;base64,${svg.toString("base64")}`;
const tileMark = readFile(join(brand, "biolyn-mark.svg")).then(svgUrl);

// The ring logo in one color, drawn like public/brand/biolyn-ring.svg.
const ringMark = (color: string) =>
  svgUrl(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="25" fill="none" stroke="${color}" stroke-width="14"/></svg>`,
    ),
  );

async function png(element: ReactElement, size: number) {
  const res = new ImageResponse(element, { width: size, height: size });
  return new Uint8Array(await res.arrayBuffer());
}

// @1x, @2x and @3x copies of one picture, the way Wallet wants them.
async function scaled(
  name: string,
  base: number,
  draw: (size: number) => ReactElement,
) {
  const entries = await Promise.all(
    [1, 2, 3].map(async (scale) => [
      scale === 1 ? `${name}.png` : `${name}@${scale}x.png`,
      await png(draw(base * scale), base * scale),
    ]),
  );
  return Object.fromEntries(entries) as Record<string, Uint8Array>;
}

// "Add to Apple Wallet": the share card as a .pkpass file. 404 until the
// Apple keys are set.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/wallet/apple/[username]">,
) {
  const config = appleConfig();
  if (!config) return new Response("Not found", { status: 404 });
  const { username } = await ctx.params;
  const pass = await passContentFor(username, request.nextUrl.searchParams);
  if (!pass) return new Response("Not found", { status: 404 });

  const { content } = pass;
  const look = passLook(content);
  const [tile, avatar] = await Promise.all([
    tileMark,
    pictureDataUrl(content.avatarUrl),
  ]);
  // Terracotta on biolyn colors; on a page theme, the theme's text color
  // so the ring stays visible on any background.
  const ring = ringMark(content.style === "page" ? look.text : look.accent);

  const image = (src: string, size: number, round = false) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: round ? size / 2 : 0, objectFit: "cover" }}
    />
  );

  const images = {
    ...(await scaled("icon", 29, (s) => image(tile, s))),
    ...(await scaled("logo", 50, (s) => image(ring, s))),
    ...(await scaled("thumbnail", 90, (s) =>
      avatar ? (
        image(avatar, s, true)
      ) : (
        <div
          style={{
            display: "flex",
            width: s,
            height: s,
            borderRadius: s / 2,
            alignItems: "center",
            justifyContent: "center",
            background: look.text,
            color: look.background,
            fontSize: s * 0.45,
            fontWeight: 700,
          }}
        >
          {initial(content.name)}
        </div>
      ),
    )),
  };

  const file = buildPkpass(content, images, config, pass.id);
  return new Response(file as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${content.username}-biolyn.pkpass"`,
      "Cache-Control": "private, no-store",
    },
  });
}
