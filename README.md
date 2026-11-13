# 7games

A clean, minimal, Apple-style games arcade. One global account (Google or email via Supabase) unlocks every game, saves scores across devices, and ranks players on per-game global leaderboards.

**Stack:** React 19 + TypeScript + Vite (fully static) · Supabase (auth + database) · Render static hosting · react-router · lucide-react icons

## Games (15 built-in)

Noughts (tic-tac-toe) · Orbit Match (memory) · Pulse (reflex) · Echo (Simon) · Merge (2048) · Minefield (minesweeper) · Gallows (hangman) · Brainline (quiz) · Number Rush (math) · Typewave (typing) · Skyline (higher/lower) · Mole Patrol (whack-a-mole) · Hue Duo (color match) · Slide (15-puzzle) · Serpent (snake)

All games work with touch (swipe/tap) and keyboard. The catalog also supports external iframe games — add one to `src/catalog.ts` with `kind: "iframe"` and an `embedUrl`.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev
```

## Supabase setup (required)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the entire contents of [`supabase/schema.sql`](supabase/schema.sql). This creates:
   - `profiles` table + trigger that auto-creates a profile on every signup (display names for leaderboards)
   - `game_scores` table with row-level security (users can only read/write their own rows)
   - a public `leaderboard` view (best score per player per game)
3. In **Authentication → Providers → Google**: enable it and paste your Google OAuth client ID/secret (create OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com) with authorized redirect URI `https://<your-project-ref>.supabase.co/auth/v1/callback`).
4. In **Authentication → URL Configuration**: set Site URL to your Render URL (e.g. `https://7games.onrender.com`) and add `http://127.0.0.1:5173` and your production URL to Redirect URLs.
5. In **Authentication → Providers → Email**: keep "Confirm email" on unless you want instant signups.
6. Copy **Project Settings → API** values into `.env.local` (or Render env vars):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

> The anon key is a public client key — it's safe to ship. RLS policies are what protect the data.

## Deploy to Render (static site)

1. Push this repo to GitHub.
2. On Render: **New → Static Site**, pick the repo. The included `render.yaml` configures the rest:
   - build: `npm install && npm run build`
   - publish: `./dist`
   - SPA rewrite so `/game/serpent`, `/login`, etc. serve `index.html`
3. Add the two `VITE_SUPABASE_*` env vars in the Render dashboard.
4. Add the Render URL to Supabase Auth redirect URLs (step 4 above).

## Architecture

```
src/
  catalog.ts          # game catalog: 15 built-in games + iframe game support
  games/              # one self-contained engine per game (15 engines)
  components/         # Nav, GameCard, Leaderboard, AuthForm
  context/            # AuthContext (session state app-wide)
  hooks/useBest.ts    # personal-best lookup per game
  lib/
    auth.tsx          # useAuthState hook + Avatar
    scores.ts         # score saving, personal scores, leaderboard reads
  pages/              # Home, GamePage, Login, Profile, AuthCallback
supabase/schema.sql   # run once in the Supabase SQL editor
render.yaml           # Render static site config
```

**Scoring:** most games score higher-is-better; Minefield and Slide record time in seconds (lower is better) — handled consistently across leaderboards and personal bests via `isLowerBetter()`.

**Guests** can play everything; their scores stay on the device. Signing in later keeps device scores locally and new rounds sync to the account.

## Admin panel (`/admin`)

Traffic, game stats, ads and site settings, behind a password that lives **only** as a Supabase secret (never in the browser bundle).

**One-time setup**

1. Run [`supabase/admin.sql`](supabase/admin.sql) in the Supabase SQL Editor (after `schema.sql`). It adds `ads`, `events`, `site_settings` and the `record_ad_event()` function, all under RLS.
2. Create a free [Cloudinary](https://cloudinary.com) account (for ad images).
3. Set the secrets and deploy the Edge Function ([Supabase CLI](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase secrets set ADMIN_PASSWORD='choose-a-long-password' \
     ADMIN_TOKEN_SECRET='another-long-random-string' \
     CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=...
   supabase functions deploy admin
   ```

4. Open `https://<your-site>/admin` and sign in. Sessions last 8 hours.

**What it does**

- **Overview / Traffic / Games:** page views, unique visitors, devices, referrers, busiest hours, per-game starts, completion and average score, live event feed.
- **Ads:** create/edit/pause/delete ads with title, link, cover + thumbnail (uploaded to Cloudinary), start/end date-time, a daily time window (viewer's local time, may cross midnight), and quantity (max impressions). The home page shows a rotating "Sponsored" box of ads that are currently eligible; the impression cap is enforced in the database.
- **Settings:** toggle ads, rotation speed, analytics collection, and a home-page announcement banner.

**Notes:** analytics are first-party (a random visitor id in `localStorage`, no cookies, no IP stored). The stats endpoint reads up to 100k events per request, which is plenty for a small site. Ad counters/clicks come from the browser, so treat them as good estimates rather than audited numbers.
