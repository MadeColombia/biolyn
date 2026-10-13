import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/profiles";

export const alt = "Biolyn profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The preview card people see when a biolyn.link is shared in a DM.
export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getPublicProfile(username.toLowerCase());
  const name = profile?.display_name ?? profile?.username ?? "Biolyn";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        background: "linear-gradient(180deg, #fb923c, #ec4899, #9333ea)",
        color: "white",
      }}
    >
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt=""
          width={200}
          height={200}
          style={{ borderRadius: 100, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 100,
            background: "rgba(255,255,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 96,
            fontWeight: 700,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ fontSize: 72, fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 40, opacity: 0.85 }}>
        {profile ? `biolyn.link/${profile.username}` : "biolyn.link"}
      </div>
    </div>,
    size,
  );
}
