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
| `src/proxy.ts` | Keeps the session fresh and protects `/dashboard` |
| `supabase/schema.sql` | Tables and Row Level Security rules |
| `supabase/migrations/` | Later database changes (socials, avatars, page views) |

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the three env vars from `.env.example` (use `https://biolyn.link` for `NEXT_PUBLIC_SITE_URL`).
3. In Vercel **Settings > Domains**, add `biolyn.link` and set the DNS records Vercel shows at your registrar.
