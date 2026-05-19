# career-ops-cloud

Cloud version of [career-ops](../career-ops): Railway + Supabase + Gemini.

## Stack

- **Frontend**: Next.js 14 App Router + Tailwind + shadcn/ui + Coreintel brand.
- **API**: Hono (Node) on Railway.
- **Workers**: Node workers on Railway (scanner cron, evaluator queue, pdfgen, liveness).
- **DB**: Supabase Postgres + RLS + Auth + Storage.
- **LLM**: Google Gemini (`gemini-2.5-pro` for evaluation, `gemini-2.5-flash` for scan filtering).
- **Queue**: `pg-boss` on Postgres.

## Monorepo layout

```
apps/
  web/        Next.js frontend
  api/        Hono REST service
  workers/    scanner | evaluator | pdfgen | liveness
packages/
  db/         Drizzle schema + migrations
  gemini/     Prompt-as-function clients for Gemini
  scan-core/  Greenhouse / Ashby / Lever clients + liveness
  shared/     Shared types, zod schemas, constants
supabase/
  migrations/ Versioned SQL migrations
scripts/
  migrate-from-md.ts   One-shot importer from legacy `career-ops` repo
docker/
  api.Dockerfile
  workers.Dockerfile  (includes Chromium for Playwright)
  web.Dockerfile
railway.json
```

## Quickstart (local)

```bash
pnpm install
cp .env.example .env  # fill in Supabase + Gemini keys
pnpm db:migrate        # apply SQL migrations
pnpm migrate:from-md   # import data from ../career-ops
pnpm dev:api           # in one terminal
pnpm dev:web           # in another
```

## Deploy

Railway picks up services from `railway.json`. Web can optionally go to Vercel.

## Single-tenant ready for SaaS

Currently locked to a single user (`DEFAULT_USER_ID`), but every table has `user_id` and RLS policies — opening signup later does not require a re-migration.
