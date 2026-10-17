// Apple Wallet pass (.pkpass) for the share card: a zip with pass.json,
// pictures, a list of their hashes (manifest.json) and a signature made
// with the owner's Pass Type ID certificate.
import "server-only";
import { createHash } from "node:crypto";
import forge from "node-forge";
import { zipSync } from "fflate";
import { translator } from "@/i18n/translate";
import { envBytes, passLook, rgb, type PassContent } from "@/lib/wallet";

export type AppleConfig = {
  key: forge.pki.PrivateKey;
  cert: forge.pki.Certificate;
  /** Apple's WWDR intermediate certificate, which signed `cert`. */
  wwdr: forge.pki.Certificate;
  passTypeId: string;
  teamId: string;
};

function certFrom(bytes: string): forge.pki.Certificate {
  return bytes.startsWith("-----BEGIN")
    ? forge.pki.certificateFromPem(bytes)
    : forge.pki.certificateFromAsn1(forge.asn1.fromDer(bytes));
}

// Subject fields by OID: UID (userId) and OU (organizationalUnitName).
const UID = "0.9.2342.19200300.100.1.1";
const OU = "2.5.4.11";

function subject(cert: forge.pki.Certificate, oid: string) {
  const value = cert.subject.attributes.find((a) => a.type === oid)?.value;
  return typeof value === "string" ? value : undefined;
}

/**
 * The Apple Wallet keys, or null while they are not set up:
 * - APPLE_PASS_P12: the Pass Type ID certificate and key, exported from
 *   Keychain Access as .p12 (base64)
 * - APPLE_PASS_P12_PASSWORD: the password chosen when exporting
 * - APPLE_WWDR_CERT: Apple's WWDR G4 certificate (.cer as base64, or PEM)
 * The Pass Type ID and Team ID are read from the certificate.
 */
export function appleConfig(
  env: Record<string, string | undefined> = process.env,
): AppleConfig | null {
  const p12 = envBytes(env.APPLE_PASS_P12);
  const wwdrBytes = envBytes(env.APPLE_WWDR_CERT);
  if (!p12 || !wwdrBytes) return null;
  try {
    const pfx = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(p12),
      env.APPLE_PASS_P12_PASSWORD ?? "",
    );
    const key =
      pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ]?.[0]?.key ??
      pfx.getBags({ bagType: forge.pki.oids.keyBag })[
        forge.pki.oids.keyBag
      ]?.[0]?.key;
    const cert = pfx.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ]?.[0]?.cert;
    if (!key || !cert) return null;
    // Apple puts the Pass Type ID in UID and the Team ID in OU.
    const passTypeId = subject(cert, UID);
    const teamId = subject(cert, OU);
    if (!passTypeId || !teamId) return null;
    return { key, cert, wwdr: certFrom(wwdrBytes), passTypeId, teamId };
  } catch (error) {
    console.error("Apple Wallet keys could not be read", error);
    return null;
  }
}

/** The pass itself: name, page address and the QR code. */
export function passJson(
  content: PassContent,
  config: Pick<AppleConfig, "passTypeId" | "teamId">,
  serialNumber: string,
) {
  const look = passLook(content);
  const t = translator(content.locale);
  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeId,
    teamIdentifier: config.teamId,
    serialNumber,
    organizationName: "biolyn",
    description: t("card.passDescription", { name: content.name }),
    logoText: "biolyn",
    backgroundColor: rgb(look.background),
    foregroundColor: rgb(look.text),
    labelColor: rgb(look.muted),
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: content.qrUrl,
        messageEncoding: "iso-8859-1",
        altText: look.address,
      },
    ],
    generic: {
      primaryFields: [{ key: "name", label: "", value: content.name }],
      secondaryFields: [{ key: "page", label: t("card.passPage"), value: look.address }],
      backFields: [
        {
          key: "link",
          label: t("card.passOpen"),
          value: content.pageUrl,
          attributedValue: `<a href="${content.pageUrl}">${look.address}</a>`,
        },
      ],
    },
  };
}

const sha1 = (data: Uint8Array) =>
  createHash("sha1").update(data).digest("hex");

/** manifest.json: the SHA-1 of every file in the pass. */
export function manifest(files: Record<string, Uint8Array>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(files).map(([name, data]) => [name, sha1(data)]),
    ),
  );
}

/** A detached PKCS #7 signature of the manifest, as Apple requires. */
export function signManifest(
  manifestText: string,
  config: Pick<AppleConfig, "key" | "cert" | "wwdr">,
): Uint8Array {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestText, "utf8");
  p7.addCertificate(config.cert);
  p7.addCertificate(config.wwdr);
  p7.addSigner({
    key: config.key as forge.pki.rsa.PrivateKey,
    certificate: config.cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // forge takes a Date here, though its types say string.
      { type: forge.pki.oids.signingTime, value: new Date() as never },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Uint8Array.from(der, (c) => c.charCodeAt(0));
}

/**
 * The finished .pkpass file. `images` are PNGs by file name (icon.png,
 * icon@2x.png, logo.png, thumbnail.png ...).
 */
export function buildPkpass(
  content: PassContent,
  images: Record<string, Uint8Array>,
  config: AppleConfig,
  serialNumber: string,
): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "pass.json": new TextEncoder().encode(
      JSON.stringify(passJson(content, config, serialNumber)),
    ),
    ...images,
  };
  const list = manifest(files);
  return zipSync({
    ...files,
    "manifest.json": new TextEncoder().encode(list),
    signature: signManifest(list, config),
  });
}
