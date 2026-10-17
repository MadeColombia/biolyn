# Email templates

Every email biolyn sends uses one layout: `src/lib/email/layout.ts`. It follows the design system (warm off-white canvas, terracotta button, ring logo, lowercase "biolyn") and switches to the dark colors in email apps that support dark mode (Apple Mail, iOS Mail, Outlook for Mac). Gmail and Outlook show the light version with a system font.

| Email | Sent by | Source |
| --- | --- | --- |
| Sign-in link (magic link) | Supabase, through Resend (`login@biolyn.link`) | `supabase/templates/magic_link.html` |
| Confirm email (first sign-in with a new address) | Supabase, through Resend | `supabase/templates/confirmation.html` |
| Error alert to the owner | The app, through Resend (`alerts@biolyn.link`) | `src/lib/alerts.ts` |

The logo is the hosted PNG `https://biolyn.link/brand/biolyn-mark-512.png` (SVG and animated logos don't work in most email apps).

## Language

Supabase keeps one template per email type, so each template holds English and Spanish and picks one with the account's saved language (`user_metadata.locale`):

- New accounts get it from the login page (`signInWithOtp` sends `data: { locale }`).
- Every sign-in updates it in `/auth/callback` to the language the person uses on the site (language cookie, then browser language).
- Accounts without one (signed up before this was added, until their next sign-in) get English.

## Pasting into Supabase

The files in `supabase/templates` are generated. Don't edit them by hand: change `src/lib/email/auth-templates.ts` (copy) or `layout.ts` (look), then run `npm run email:templates` and commit the result.

In the Supabase dashboard open **Authentication > Email Templates** (https://supabase.com/dashboard/project/xbamjudxiatwuwggiijv/auth/templates). For each template below, replace the **Subject** with the one-line `.subject.txt` file and the **Body** (Source tab) with the `.html` file, then **Save changes**.

| Supabase template | Subject | Body |
| --- | --- | --- |
| Magic Link | `magic_link.subject.txt` | `magic_link.html` |
| Confirm signup | `confirmation.subject.txt` | `confirmation.html` |

The subject lines look like code (`{{ if eq ... }}`): that's on purpose, it's how they pick the language. Recipients only see "Your sign-in link" or "Tu enlace para entrar".

Check after saving: sign out, request a sign-in link from https://biolyn.link/login, and open the email. To test Spanish, switch the site to Español in the footer first, sign in once (that saves Spanish on your account), sign out and ask for a new link.

## Previews

`/mnt/project-files/biolyn/screenshots/email-templates/` in the project has every email in light and dark, desktop and phone width. They were rendered with Go's `html/template`, the same engine Supabase uses, so the language switch was tested too.
