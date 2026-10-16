# Wallet passes (Apple Wallet and Google Wallet)

The share card in the dashboard can also be saved as a wallet pass. The pass shows the photo, the name, the page address and the QR code, in the card style the person picked. Each wallet's button stays hidden, and its route returns 404, until that wallet's keys are set in Vercel. Apple and Google work independently, so you can turn on one without the other.

| Wallet | Route | Code |
| ------ | ----- | ---- |
| Apple  | `/api/wallet/apple/[username]?style=&s=` returns a `.pkpass` file | `src/lib/apple-pass.ts` |
| Google | `/api/wallet/google/[username]?style=&s=` redirects to a Google "save" link | `src/lib/google-pass.ts` |

Keys never go in the repo. Add them in Vercel under Project Settings > Environment Variables (Production and Preview), then redeploy.

## Apple Wallet

You need a paid Apple Developer account.

1. Go to developer.apple.com > Certificates, Identifiers & Profiles > Identifiers. Add a **Pass Type ID**, for example `pass.link.biolyn.card`.
2. Open that Pass Type ID and create its certificate. Apple asks for a certificate signing request: on a Mac, make one in Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority, and save it to disk.
3. Download the certificate and double-click it to add it to Keychain Access.
4. In Keychain Access > My Certificates, right-click "Pass Type ID: pass.link.biolyn.card" > Export, save it as `pass.p12` and choose a password.
5. Download Apple's **Worldwide Developer Relations - G4** certificate (`AppleWWDRCAG4.cer`) from apple.com/certificateauthority.
6. Turn both files into text you can paste:

   ```sh
   base64 -i pass.p12 | pbcopy             # paste as APPLE_PASS_P12
   base64 -i AppleWWDRCAG4.cer | pbcopy    # paste as APPLE_WWDR_CERT
   ```

| Variable | Value |
| -------- | ----- |
| `APPLE_PASS_P12` | base64 of `pass.p12` |
| `APPLE_PASS_P12_PASSWORD` | the password from step 4 |
| `APPLE_WWDR_CERT` | base64 of `AppleWWDRCAG4.cer` (a PEM copy also works) |

The Pass Type ID and Team ID are read from the certificate, so they need no variables of their own. The certificate expires after a year: repeat steps 2 to 6 and update `APPLE_PASS_P12`.

## Google Wallet

The Google Pay & Wallet Console is free.

1. Sign up at pay.google.com/business/console, open Google Wallet API, and copy the **Issuer ID**.
2. In Google Cloud Console, pick or create a project, enable the **Google Wallet API**, then go to IAM & Admin > Service accounts and create one. Under Keys, add a JSON key and download it.
3. Back in the Wallet Console, go to Users and invite the service account's email (`...@...iam.gserviceaccount.com`) as a Developer.
4. Paste the values:

| Variable | Value |
| -------- | ----- |
| `GOOGLE_WALLET_ISSUER_ID` | the Issuer ID from step 1 |
| `GOOGLE_WALLET_KEY` | the whole JSON key file (or `base64 -i key.json`) |

While the issuer account is in demo mode, only the console's test users can save passes. Ask Google for publishing access in the console when you want everyone to use it.

## How to check

- Locally, `npm test` covers both wallets with made-up keys (`tests/helpers/wallet-keys.ts`), including the pass signature.
- After setting the keys on a preview deployment, the buttons appear under the share card. On an iPhone, "Add to Apple Wallet" should open the add-pass screen. On Android, "Add to Google Wallet" should open Google Wallet. Scan the pass's QR code to confirm it opens the page.
- If a button stays hidden after setting the keys, check that each value was pasted whole and the password is right, then redeploy.
