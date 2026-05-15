# Wheeler Smart Analytics V2

Next.js 16 app with Supabase auth and GA4 advance dashboards.

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

This repo is a standard **Next.js App Router** project at the repository root — no monorepo or custom output directory.

1. Push the repo to GitHub (or GitLab / Bitbucket).
2. In [Vercel](https://vercel.com/new), **Import** the repository.
3. Vercel should auto-detect **Next.js**. Leave defaults:
   - **Root Directory:** `.` (repository root)
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`
   - **Output:** handled by Next.js (do not set a static `output` folder)
4. Add **Environment Variables** (Production and Preview):

   | Name | Required | Notes |
   |------|----------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | No | **Do not** add in production; local dev only |

5. Deploy. After deploy, sign in with a **Supabase user** (demo login is disabled in production).

### Supabase for production

- Enable Email auth (or your provider) in the Supabase dashboard.
- Add your Vercel URL to **Authentication → URL configuration** (Site URL and Redirect URLs), e.g. `https://your-app.vercel.app` and `https://your-app.vercel.app/**`.
- Ensure RLS policies allow authenticated reads on `smart_ga4_config` and `smart_master_db` (see `supabase/migrations/`).

### Verify build locally

```bash
npm run build
npm start
```

## Project layout

```
├── middleware.ts          # Supabase session + route protection
├── next.config.ts
├── vercel.json            # Vercel framework hint (optional)
├── public/
├── src/
│   ├── app/               # App Router pages and API routes
│   ├── components/
│   ├── lib/supabase/      # Supabase clients and dashboard queries
│   └── types/
└── supabase/migrations/   # SQL for RLS (apply in Supabase SQL editor)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build (same as Vercel) |
| `npm start` | Run production build locally |
| `npm run lint` | ESLint |
