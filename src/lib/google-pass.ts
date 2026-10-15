// Google Wallet pass for the share card. Google needs no file: we send the
// visitor to a "save" link that carries the whole pass in a signed token.
import "server-only";
import { createSign } from "node:crypto";
import { envBytes, passLook, type PassContent } from "@/lib/wallet";

export type GoogleConfig = {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
};

/**
 * The Google Wallet keys, or null while they are not set up:
 * - GOOGLE_WALLET_ISSUER_ID: from the Google Pay & Wallet Console
 * - GOOGLE_WALLET_KEY: the service account's JSON key (as is, or base64)
 */
export function googleConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const json = envBytes(env.GOOGLE_WALLET_KEY);
  if (!issuerId || !json) return null;
  try {
    const key = JSON.parse(json) as {
      client_email?: unknown;
      private_key?: unknown;
    };
    if (
      typeof key.client_email !== "string" ||
      typeof key.private_key !== "string"
    ) {
      return null;
    }
    return {
      issuerId,
      clientEmail: key.client_email,
      privateKey: key.private_key,
    };
  } catch {
    console.error("Google Wallet key is not valid JSON");
    return null;
  }
}

const text = (value: string) => ({
  defaultValue: { language: "en", value },
});

/** The pass class (shared by every card) and this card's pass object. */
export function googlePass(
  content: PassContent,
  config: Pick<GoogleConfig, "issuerId">,
  objectSuffix: string,
  siteUrl: string,
) {
  const look = passLook(content);
  const classId = `${config.issuerId}.biolyn_share_card`;
  return {
    genericClasses: [{ id: classId }],
    genericObjects: [
      {
        id: `${config.issuerId}.${objectSuffix}`,
        classId,
        state: "ACTIVE",
        hexBackgroundColor: look.background,
        cardTitle: text("biolyn"),
        header: text(content.name),
        subheader: text(look.address),
        // The round picture at the top: their photo, else the biolyn mark.
        logo: {
          sourceUri: {
            uri: content.avatarUrl ?? `${siteUrl}/brand/biolyn-mark-512.png`,
          },
          contentDescription: text(content.name),
        },
        barcode: {
          type: "QR_CODE",
          value: content.qrUrl,
          alternateText: look.address,
        },
        linksModuleData: {
          uris: [{ uri: content.pageUrl, description: "Open the page" }],
        },
      },
    ],
  };
}

const base64url = (data: string | Buffer) =>
  Buffer.from(data).toString("base64url");

/** Signs the pass as a JWT (RS256) with the service account key. */
export function signJwt(
  payload: object,
  config: Pick<GoogleConfig, "clientEmail" | "privateKey">,
  origins: string[],
  now = Date.now(),
): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(now / 1000),
      origins,
      payload,
    }),
  );
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(config.privateKey);
  return `${header}.${claims}.${base64url(signature)}`;
}

/** The link that opens Google Wallet with the pass ready to save. */
export function googleSaveUrl(
  content: PassContent,
  config: GoogleConfig,
  objectSuffix: string,
  siteUrl: string,
): string {
  const jwt = signJwt(
    googlePass(content, config, objectSuffix, siteUrl),
    config,
    [siteUrl],
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
