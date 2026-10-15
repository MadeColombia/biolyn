import { NextResponse, type NextRequest } from "next/server";
import { googleConfig, googleSaveUrl } from "@/lib/google-pass";
import { passContentFor, siteUrl } from "@/lib/pass-content";

// "Add to Google Wallet": sends the visitor to Google with the share
// card's pass in a signed link. 404 until the Google keys are set.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/wallet/google/[username]">,
) {
  const config = googleConfig();
  if (!config) return new Response("Not found", { status: 404 });
  const { username } = await ctx.params;
  const pass = await passContentFor(username, request.nextUrl.searchParams);
  if (!pass) return new Response("Not found", { status: 404 });
  const url = googleSaveUrl(pass.content, config, pass.id, siteUrl());
  return NextResponse.redirect(url, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
