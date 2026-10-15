import { createPublicKey, verify } from "node:crypto";
import { unzipSync } from "fflate";
import forge from "node-forge";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { appleConfig, buildPkpass, manifest, passJson } from "@/lib/apple-pass";
import {
  googleConfig,
  googlePass,
  googleSaveUrl,
  signJwt,
} from "@/lib/google-pass";
import { pictureDataUrl } from "@/lib/remote-picture";
import {
  envBytes,
  passId,
  passLook,
  rgb,
  solidColor,
  type PassContent,
} from "@/lib/wallet";
import { appleTestKeys, googleTestKeys } from "../helpers/wallet-keys";

const content: PassContent = {
  username: "ana",
  name: "Ana Restrepo",
  qrUrl: "https://biolyn.link/ana?s=flyer",
  pageUrl: "https://biolyn.link/ana",
  avatarUrl: "https://cdn.example/ana.jpg",
  style: "page",
  theme: "sunset",
  code: "flyer",
};

describe("wallet helpers", () => {
  it("reads keys as PEM, JSON or base64", () => {
    expect(envBytes(undefined)).toBeNull();
    expect(envBytes("  ")).toBeNull();
    expect(envBytes("-----BEGIN X-----\\r\\nabc\\n-----END X-----")).toBe(
      "-----BEGIN X-----\nabc\n-----END X-----",
    );
    expect(envBytes('{"a":"x\\ny"}')).toBe('{"a":"x\\ny"}');
    expect(envBytes(Buffer.from("hello").toString("base64"))).toBe("hello");
  });

  it("turns colors into what wallets want", () => {
    expect(solidColor("#123456")).toBe("#123456");
    expect(
      solidColor("linear-gradient(180deg, #fb923c, #ec4899, #9333ea)"),
    ).toBe("#ec4899");
    expect(solidColor("transparent")).toBe("#ffffff");
    expect(rgb("#b9532d")).toBe("rgb(185, 83, 45)");
    expect(rgb("rgba(255,255,255,0.85)")).toBe("rgb(255, 255, 255)");
    expect(rgb("nope")).toBe("rgb(0, 0, 0)");
  });

  it("builds the look from the card style", () => {
    expect(passLook(content)).toMatchObject({
      background: "#ec4899",
      text: "#ffffff",
      address: "biolyn.link/ana",
    });
    expect(passLook({ ...content, style: "night" }).background).toBe("#15110f");
  });

  it("makes safe pass ids", () => {
    expect(passId(content, "v1")).toBe("ana_flyer_page_v1");
    expect(passId({ ...content, username: "a.b", code: null }, "v1")).toBe(
      "a-b_page_page_v1",
    );
  });
});

describe("Apple Wallet", () => {
  let keys: ReturnType<typeof appleTestKeys>;
  beforeAll(() => {
    keys = appleTestKeys();
  });

  it("stays off until every key is set", () => {
    expect(appleConfig({})).toBeNull();
    expect(appleConfig({ APPLE_PASS_P12: keys.env.APPLE_PASS_P12 })).toBeNull();
  });

  it("reads the Pass Type ID and Team ID from the certificate", () => {
    const config = appleConfig(keys.env);
    expect(config?.passTypeId).toBe("pass.link.biolyn.test");
    expect(config?.teamId).toBe("TEAM123456");
  });

  it("accepts the WWDR certificate as base64 .cer too", () => {
    const der = forge.asn1
      .toDer(
        forge.pki.certificateToAsn1(forge.pki.certificateFromPem(keys.wwdrPem)),
      )
      .getBytes();
    const config = appleConfig({
      ...keys.env,
      APPLE_WWDR_CERT: Buffer.from(der, "binary").toString("base64"),
    });
    expect(config?.wwdr.subject.getField("CN")?.value).toBe("Test WWDR");
  });

  it("stays off with a wrong password", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      appleConfig({ ...keys.env, APPLE_PASS_P12_PASSWORD: "wrong" }),
    ).toBeNull();
  });

  it("stays off when the certificate has no Pass Type ID", () => {
    const key = forge.pki.rsa.generateKeyPair(512);
    const cert = forge.pki.createCertificate();
    cert.publicKey = key.publicKey;
    cert.setSubject([{ name: "commonName", value: "Not a pass" }]);
    cert.setIssuer([{ name: "commonName", value: "Not a pass" }]);
    cert.sign(key.privateKey);
    const p12 = forge.pkcs12.toPkcs12Asn1(key.privateKey, cert, "pw", {
      algorithm: "3des",
    });
    expect(
      appleConfig({
        ...keys.env,
        APPLE_PASS_P12: Buffer.from(
          forge.asn1.toDer(p12).getBytes(),
          "binary",
        ).toString("base64"),
        APPLE_PASS_P12_PASSWORD: "pw",
      }),
    ).toBeNull();
  });

  it("writes the pass with the QR code and the card colors", () => {
    const pass = passJson(
      content,
      { passTypeId: "pass.x", teamId: "T1" },
      "s1",
    );
    expect(pass).toMatchObject({
      passTypeIdentifier: "pass.x",
      teamIdentifier: "T1",
      serialNumber: "s1",
      backgroundColor: "rgb(236, 72, 153)",
      barcodes: [
        {
          format: "PKBarcodeFormatQR",
          message: "https://biolyn.link/ana?s=flyer",
        },
      ],
    });
    expect(pass.generic.primaryFields[0].value).toBe("Ana Restrepo");
  });

  it("lists every file's SHA-1 in the manifest", () => {
    const list = JSON.parse(
      manifest({ "a.txt": new TextEncoder().encode("abc") }),
    );
    expect(list).toEqual({
      "a.txt": "a9993e364706816aba3e25717850c26c9cd0d89d",
    });
  });

  it("zips a signed .pkpass", () => {
    const config = appleConfig(keys.env)!;
    const icon = new Uint8Array([1, 2, 3]);
    const files = unzipSync(
      buildPkpass(content, { "icon.png": icon }, config, "s1"),
    );
    expect(Object.keys(files).sort()).toEqual([
      "icon.png",
      "manifest.json",
      "pass.json",
      "signature",
    ]);

    const list = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
    expect(Object.keys(list).sort()).toEqual(["icon.png", "pass.json"]);

    // A detached signature carrying both certificates.
    const der = Buffer.from(files.signature).toString("binary");
    const p7 = forge.pkcs7.messageFromAsn1(
      forge.asn1.fromDer(der),
    ) as unknown as {
      certificates: forge.pki.Certificate[];
      rawCapture: { content?: unknown };
    };
    expect(p7.certificates.map((c) => c.subject.getField("CN")?.value)).toEqual(
      ["Pass Type ID: pass.link.biolyn.test", "Test WWDR"],
    );
    expect(p7.rawCapture.content).toBeUndefined();
  });
});

describe("Google Wallet", () => {
  let keys: ReturnType<typeof googleTestKeys>;
  beforeAll(() => {
    keys = googleTestKeys();
  });

  it("stays off until the issuer and key are set", () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ GOOGLE_WALLET_ISSUER_ID: "1" })).toBeNull();
    expect(
      googleConfig({ ...keys.env, GOOGLE_WALLET_KEY: '{"client_email":1}' }),
    ).toBeNull();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      googleConfig({ ...keys.env, GOOGLE_WALLET_KEY: "{not json" }),
    ).toBeNull();
  });

  it("reads the service account key", () => {
    expect(googleConfig(keys.env)).toMatchObject({
      issuerId: "3388000000012345678",
      clientEmail: "wallet@test.iam.gserviceaccount.com",
    });
  });

  it("describes the pass with the QR code and the photo", () => {
    const { genericClasses, genericObjects } = googlePass(
      content,
      { issuerId: "9" },
      "ana_x",
      "https://biolyn.link",
    );
    expect(genericClasses).toEqual([{ id: "9.biolyn_share_card" }]);
    expect(genericObjects[0]).toMatchObject({
      id: "9.ana_x",
      classId: "9.biolyn_share_card",
      hexBackgroundColor: "#ec4899",
      header: { defaultValue: { value: "Ana Restrepo" } },
      barcode: { type: "QR_CODE", value: "https://biolyn.link/ana?s=flyer" },
      logo: { sourceUri: { uri: "https://cdn.example/ana.jpg" } },
    });
    const noPhoto = googlePass(
      { ...content, avatarUrl: null },
      { issuerId: "9" },
      "x",
      "https://biolyn.link",
    );
    expect(noPhoto.genericObjects[0].logo.sourceUri.uri).toBe(
      "https://biolyn.link/brand/biolyn-mark-512.png",
    );
  });

  it("signs a save link Google can check", () => {
    const config = googleConfig(keys.env)!;
    const url = googleSaveUrl(content, config, "ana_x", "https://biolyn.link");
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const [h, c, s] = url.split("/").pop()!.split(".");
    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(`${h}.${c}`),
        createPublicKey(keys.publicPem),
        Buffer.from(s, "base64url"),
      ),
    ).toBe(true);
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({
      iss: "wallet@test.iam.gserviceaccount.com",
      aud: "google",
      typ: "savetowallet",
      origins: ["https://biolyn.link"],
    });
    expect(claims.payload.genericObjects[0].id).toBe(
      "3388000000012345678.ana_x",
    );
  });

  it("puts the time in the token", () => {
    const config = googleConfig(keys.env)!;
    const jwt = signJwt({}, config, [], 1_700_000_000_000);
    const claims = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString(),
    );
    expect(claims.iat).toBe(1_700_000_000);
  });
});

describe("pictureDataUrl", () => {
  it("returns null without a picture", async () => {
    expect(await pictureDataUrl(null)).toBeNull();
  });

  it("turns a picture into a data URL", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(new Uint8Array([1, 2]), {
          headers: { "content-type": "image/png" },
        }),
    );
    expect(await pictureDataUrl("https://x/a.png")).toBe(
      "data:image/png;base64,AQI=",
    );
  });

  it("ignores pages that are not pictures, and errors", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("<html>", { headers: { "content-type": "text/html" } }),
    );
    expect(await pictureDataUrl("https://x/a")).toBeNull();
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    expect(await pictureDataUrl("https://x/a")).toBeNull();
  });
});
