# Biolyn

A link-in-bio page for Instagram. Each user claims a username and gets a public page at `biolyn.link/<username>` with their links.

Stack: Next.js (App Router, Cache Components), TypeScript, Tailwind CSS, Supabase (Postgres + Auth), hosted on Vercel.

## First-time setup

1. Create a free project at https://supabase.com.
2. In Supabase, open **SQL Editor**, run `supabase/schema.sql`, then each file in `supabase/migrations/` in order.
3. In Supabase, open **Authentication > URL Configuration** and add these redirect URLs:
   `http://localhost:3000/auth/callback` and `https://biolyn.link/auth/callback`.
4. Copy the env file and fill it in from **Project Settings > API**:
   ```bash
   cp .env.example .env.local
   ```
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
6. Open http://localhost:3000, sign in with your email, claim a username, add a link, then open `http://localhost:3000/<username>`.

## Checks

```bash
npm run lint
npm run build
```

## Project map

| Path | What it does |
|---|---|
| `src/app/page.tsx` | Landing page |
| `src/app/login/page.tsx` | Email magic-link sign in |
| `src/app/auth/callback/route.ts` | Finishes sign in from the email link |
| `src/app/dashboard/` | Claim username, edit profile, add/hide/reorder/delete links |
| `src/app/[username]/page.tsx` | Public profile page (cached, refreshed on every edit) |
| `src/app/api/click/[linkId]/route.ts` | Logs a click, then redirects to the real URL |
| `src/app/report/[username]/` | Report form linked from every public page |
| `src/lib/link-safety.ts` | Checks new links (no local/IP addresses, optional Google Safe Browsing) |
| `src/lib/rate-limit.ts` | Per-visitor limits for views, clicks, reports and adding links |
| `src/proxy.ts` | Keeps the session fresh and protects `/dashboard` |
| `supabase/schema.sql` | Tables and Row Level Security rules |
| `supabase/migrations/` | Later database changes (socials, avatars, page views, reports and rate limits) |

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the env vars from `.env.example` (use `https://biolyn.link` for `NEXT_PUBLIC_SITE_URL`). `SUPABASE_SERVICE_ROLE_KEY` is required for view and click counting once migration 004 is applied; `SAFE_BROWSING_API_KEY` is optional.
3. In Vercel **Settings > Domains**, add `biolyn.link` and set the DNS records Vercel shows at your registrar.

## Moderation

- Reports land in the `reports` table (Supabase > Table Editor). Set `status` to `closed` when handled.
- To hide a page, set `is_suspended` to `true` on its row in `profiles`. Its links stop redirecting at once, and the page itself disappears within about an hour (cache).
