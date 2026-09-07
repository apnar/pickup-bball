# pickup-bball

App to organize a group of folks to get together and play basketball weekly.

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Hono, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - API routes, served from inside the TanStack Start Worker
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Cloudflare Workers** - Hosting for the whole site, single Worker
- **Drizzle** - TypeScript-first ORM
- **Cloudflare D1** - SQLite database
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
- **Biome** - Linting and formatting

## Getting Started

Install dependencies:

```bash
pnpm install
```

## How it is hosted

The whole site runs as a single Cloudflare Worker on the free plan:

- `apps/web` is a TanStack Start app built with the Cloudflare Vite plugin. Static assets are served by Workers Assets and pages are server-rendered in the Worker.
- The Hono API lives inside the same Worker at `/api/*` (`apps/web/src/server/app.ts`, mounted by `apps/web/src/routes/api/$.ts`). Same origin means no CORS and ordinary same-site cookies.
  - `/api/auth/*` - Better Auth
  - `/api/rpc` - oRPC (the web app calls this from the browser and calls the router directly during SSR)
  - `/api/reference` - OpenAPI reference
  - `/api/health` - health check
- The database is Cloudflare D1 (SQLite) accessed through Drizzle via the `DB` binding. Env vars, secrets and bindings come from `cloudflare:workers` (typed in `packages/env/env.d.ts`, which must match `apps/web/wrangler.jsonc`).

## Local development

1. Create `apps/web/.dev.vars` from `apps/web/.dev.vars.example` and set a random `BETTER_AUTH_SECRET`.
2. Apply the migrations to the local D1 database (stored under `apps/web/.wrangler/`):

```bash
pnpm run db:migrate:local
```

3. Start the dev server. Vite runs the server side inside workerd, so bindings behave as they do in production:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Games, permits and admins

A game exists only once a gym has been rented. Admins book games and file the permit PDFs; everyone else sees the schedule and the next game's headcount.

- **Admins** are accounts with `role = 'admin'` (Better Auth's admin plugin). Promote the first one with a SQL command, then use the Users tab on `/admin` to promote others:

```bash
pnpm --filter web exec wrangler d1 execute DB --remote --command "update user set role='admin' where email='you@example.com'"
```

  Drop `--remote` to do the same against the local database.
- **Games** live in the `game` table (date, tip-off, court, notes, optional permit). Admins manage them on `/admin`. The home page shows the next game on or after today; `/schedule` lists upcoming and recent games.
- **Permits** are PDFs stored in the `PERMITS` R2 bucket (`pickup-bball-permits`) with a row in the `permit` table. Admins upload them on `/admin/permits` and attach them to games. Anyone with the link can open `/api/permits/<id>/file` (add `?download=1` to download), so a permit can be shown to gym staff from any phone.
- **Headcount** rows in `rsvp` belong to a game (`game_id`). Anyone can add a name or flip it In/Out for the next game; no sign-in is required. Deleting a game deletes its headcount.

The oRPC procedures are `games.*`, `permits.*` and `rsvp.*` under `packages/api/src/routers`. Admin-only procedures use `adminProcedure` from `packages/api/src/index.ts`. Roster, rules and game conditions remain plain content in `apps/web/src/content/run.ts`.

## Database changes

1. Edit the schema in `packages/db/src/schema`.
2. Generate a migration: `pnpm run db:generate`. This writes SQL into `packages/db/src/migrations`, which is what wrangler applies.
3. Apply it locally with `pnpm run db:migrate:local`, and to production with `pnpm run db:migrate:remote`.

Inspect the local database with `pnpm --filter web exec wrangler d1 execute DB --local --command "select * from user"`.

## Deploying to Cloudflare

One-time setup:

1. Log in: `pnpm --filter web exec wrangler login`.
2. Create the database: `pnpm --filter web exec wrangler d1 create pickup-bball-db` and paste the returned id into `database_id` in `apps/web/wrangler.jsonc`.
3. Set the auth secret: `pnpm --filter web exec wrangler secret put BETTER_AUTH_SECRET`.
4. Create the permit bucket: `pnpm --filter web exec wrangler r2 bucket create pickup-bball-permits`.
5. Apply migrations to production: `pnpm run db:migrate:remote`.
6. Deploy: `pnpm run deploy`.
7. Set `BETTER_AUTH_URL` in `apps/web/wrangler.jsonc` `vars` to the URL wrangler printed (or your custom domain) and deploy again.
8. Sign up on the site, then promote yourself to admin with the command in "Games, permits and admins".

### Automatic deploys

`.github/workflows/deploy.yml` runs on every push and pull request. It lints with Biome, typechecks and builds. On pushes to `main` it then applies pending D1 migrations and deploys the Worker with Cloudflare's `wrangler-action`.

It needs one repository secret, `CLOUDFLARE_API_TOKEN`: a Cloudflare API token created from the "Edit Cloudflare Workers" template with **D1: Edit** and **Workers R2 Storage: Edit** added. Set it with `gh secret set CLOUDFLARE_API_TOKEN` or in the repository's Actions secrets. Until the secret exists the deploy job skips with a warning instead of failing. The account id is in `apps/web/wrangler.jsonc`, so no account secret is needed.

You can still deploy by hand with `pnpm run deploy`.

## Project Structure

```
pickup-bball/
├── apps/
│   └── web/         # Fullstack app: TanStack Start pages + Hono API under /api (one Worker)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # oRPC router / business logic
│   ├── auth/        # Better Auth configuration
│   ├── db/          # Drizzle schema (auth, game, permit, rsvp) and D1 migrations
│   └── env/         # Typed access to Worker env and bindings
```

## Available Scripts

- `pnpm run dev`: Start the dev server (pages and API) at http://localhost:3001
- `pnpm run build`: Build the Worker and static assets
- `pnpm run check-types`: Check TypeScript types across the workspace
- `pnpm run check`: Run Biome formatting and linting
- `pnpm run db:generate`: Generate a D1 migration from the Drizzle schema
- `pnpm run db:migrate:local`: Apply migrations to the local D1 database
- `pnpm run db:migrate:remote`: Apply migrations to the production D1 database
- `pnpm run deploy`: Build and deploy the Worker with wrangler
