// Made-up Apple and Google Wallet keys for tests, shaped like the real
// ones: an Apple pass certificate (with UID and OU) signed by a stand-in
// for Apple's WWDR certificate, exported as .p12, and a Google service
// account JSON key.
import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return {
    privatePem: privateKey,
    publicPem: publicKey,
    privateKey: forge.pki.privateKeyFromPem(privateKey),
    publicKey: forge.pki.publicKeyFromPem(publicKey),
  };
}

function certificate(
  subject: forge.pki.CertificateField[],
  publicKey: forge.pki.PublicKey,
  issuer: forge.pki.CertificateField[],
  signingKey: forge.pki.PrivateKey,
  ca: boolean,
  serial: string,
) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = serial;
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000 * 365);
  cert.setSubject(subject);
  cert.setIssuer(issuer);
  cert.setExtensions([{ name: "basicConstraints", cA: ca }]);
  cert.sign(signingKey as forge.pki.rsa.PrivateKey, forge.md.sha256.create());
  return cert;
}

export function appleTestKeys(password = "secret") {
  const ca = keyPair();
  const wwdrName = [{ name: "commonName", value: "Test WWDR" }];
  const wwdr = certificate(
    wwdrName,
    ca.publicKey,
    wwdrName,
    ca.privateKey,
    true,
    "01",
  );
  const pass = keyPair();
  const passCert = certificate(
    [
      { type: "0.9.2342.19200300.100.1.1", value: "pass.link.biolyn.test" },
      { name: "commonName", value: "Pass Type ID: pass.link.biolyn.test" },
      { shortName: "OU", value: "TEAM123456" },
    ],
    pass.publicKey,
    wwdrName,
    ca.privateKey,
    false,
    "02",
  );
  const p12 = forge.pkcs12.toPkcs12Asn1(
    pass.privateKey as forge.pki.rsa.PrivateKey,
    passCert,
    password,
    {
      algorithm: "3des",
    },
  );
  return {
    env: {
      APPLE_PASS_P12: Buffer.from(
        forge.asn1.toDer(p12).getBytes(),
        "binary",
      ).toString("base64"),
      APPLE_PASS_P12_PASSWORD: password,
      APPLE_WWDR_CERT: forge.pki.certificateToPem(wwdr),
    },
    wwdrPem: forge.pki.certificateToPem(wwdr),
    passCertPem: forge.pki.certificateToPem(passCert),
  };
}

export function googleTestKeys() {
  const pair = keyPair();
  const json = JSON.stringify({
    type: "service_account",
    client_email: "wallet@test.iam.gserviceaccount.com",
    private_key: pair.privatePem,
  });
  return {
    env: {
      GOOGLE_WALLET_ISSUER_ID: "3388000000012345678",
      GOOGLE_WALLET_KEY: Buffer.from(json).toString("base64"),
    },
    publicPem: pair.publicPem,
  };
}
