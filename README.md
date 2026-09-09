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
- **Email** - Brevo transactional API, called with plain `fetch` from `packages/email`
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
  - `/api/unsubscribe/:token` - one-click unsubscribe pages for list emails
  - `/api/brevo/webhook` - Brevo tells the app who unsubscribed, bounced or complained
  - `/api/health` - health check
- A Cron Trigger runs the Worker's `scheduled` handler (`apps/web/src/server.ts`) every hour. It sends the game-day reminder once it is 9 AM at the gym, once per game.
- The database is Cloudflare D1 (SQLite) accessed through Drizzle via the `DB` binding. Env vars, secrets and bindings come from `cloudflare:workers` (typed in `packages/env/env.d.ts`, which must match `apps/web/wrangler.jsonc`).

## Local development

1. Create `apps/web/.dev.vars` from `apps/web/.dev.vars.example` and set a random `BETTER_AUTH_SECRET`. `BREVO_API_KEY` is optional: without it every email is printed to the dev server's console instead of sent, which is the normal local setup.
2. Apply the migrations to the local D1 database (stored under `apps/web/.wrangler/`):

```bash
pnpm run db:migrate:local
```

3. Start the dev server. Vite runs the server side inside workerd, so bindings behave as they do in production:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Who sees what

The site is two sites wearing one coat.

- **Anonymous visitors** get the pitch: Monday nights, somewhere in Montgomery County, the rules, and how to get in. No court, no tip-off time, no booked dates, no headcount, no names.
- **Players** — anyone with a session — get everything: the next game with its court and time, the schedule, the roster, and one-tap RSVP under their own name.

Nobody signs themselves up. Public sign-up is closed (`emailAndPassword.disableSignUp`), and there is no join form. An admin adds an address on `/admin/email`, the welcome email goes out, and **every link in every email that person gets is unique to them and signs them in when clicked**. That link is a bearer token, which is why the emails say not to forward it. The one exception is the permit PDF: it is meant to be waved at gym staff, so its URL carries nothing.

Sessions last 180 days and roll forward. The session cookie caches the user for five minutes, so ordinary navigation costs no database read — and a role changed by SQL takes up to five minutes to show up.

Losing access: unsubscribing from emails does not revoke it. Removing someone on `/admin/email` does, since their token goes with the row; live sessions can be revoked from `/admin/users`.

Passwords are optional. Password sign-in is still the default form on `/login` (admins use it), and any player can set one from `/dashboard`; the emailed links keep working either way. Below the sign-in form, "Email me my link" mails a fresh one to any address on the list, at most once every ten minutes, and says the same thing whether or not the address is on it.

## Games, permits and admins

A game exists only once a gym has been rented. Admins book games and file the permit PDFs; players see the schedule and the next game's headcount.

- **Admins** are accounts with `role = 'admin'` (Better Auth's admin plugin). Promote the first one with a SQL command, then use the Users tab on `/admin` to promote others:

```bash
pnpm --filter web exec wrangler d1 execute DB --remote --command "update user set role='admin' where email='you@example.com'"
```

  Drop `--remote` to do the same against the local database.
- **Games** live in the `game` table (date, tip-off, court, notes, optional permit). Admins manage them on `/admin`. The home page shows the next game on or after today; `/schedule` lists upcoming and recent games. Both are players-only.
- **Permits** are PDFs stored in the `PERMITS` R2 bucket (`pickup-bball-permits`) with a row in the `permit` table. Admins upload them on `/admin/permits` and attach them to games. Anyone with the link can open `/api/permits/<id>/file` (add `?download=1` to download), so a permit can be shown to gym staff from any phone.
- **Headcount** rows in `rsvp` belong to a game (`game_id`). A player taps "I'm in as {name}" to put themselves on the sheet (`rsvp.addMe`, which claims the row by `user_id` and marks it "you"), and can type a friend's name in as well. Deleting a game deletes its headcount.

The oRPC procedures are `account.*`, `games.*`, `permits.*`, `rsvp.*`, `subscribers.*` and `mail.*` under `packages/api/src/routers`. Admin-only procedures use `adminProcedure` from `packages/api/src/index.ts`; `games.*` and `rsvp.*` reads are `protectedProcedure`, so a stranger gets UNAUTHORIZED rather than the address of the gym. Roster, rules and game conditions remain plain content in `apps/web/src/content/run.ts`.

## Email

Players hear about games by email, and get in through the links in them. Brevo delivers; the app owns the list, the templates and the log.

- **Who gets it.** The `subscriber` table — the same table that decides who is a player. Admins add rows on `/admin/email` (`source = 'admin'`); older rows came from the site form (`site`) and the old public sign-up (`signup`). Each row has an `unsubscribe_token` for the unsubscribe link and a `link_token` for the sign-in links, both plain text (they ride in every email anyway). Signed-in players can flip "Game emails" off on `/dashboard`; a past unsubscribe is respected if the same address turns up again.
- **How a link signs you in.** Every link in a list email points at `/api/auth/link?k=<link_token>&to=<path>`, a GET endpoint added by the `email-link` plugin in `packages/auth/src/link.ts`. It finds the subscriber, creates their `user` row on the first click (no password, `email_verified = 1`) or marks an existing unverified one verified, links `subscriber.user_id`, opens a session and redirects to `to` — which is checked by `safeReturnPath` and falls back to `/` for anything that points off this site. An unknown token lands on `/login?error=link`.
- **What goes out.**
  - *Welcome* — when an admin adds someone, or resends their link from the subscriber table, or a player asks for one from `/login`. Carries their concrete sign-in link, no unsubscribe footer.
  - *Announcement* — when a gym is booked. Manual: on `/admin/email`, preview the email for the game, then send. The game records `announced_at`. Individual people can be sent it again from the subscriber table.
  - *Reminder* — the morning of a game, with the current headcount and who is In. Sent by the hourly Cron Trigger once it is 9 AM Eastern (`REMINDER_LOCAL_HOUR` in `packages/api/src/jobs/reminders.ts`), at most once per game (`game.reminder_sent_at` is the lock). Admins can also send it early from `/admin/email`.
  - *Message* — anything an admin types on `/admin/email`. "Send to me first" delivers a test copy to the signed-in admin only, with their own token substituted so the links are real.
  - *Account* — Better Auth's password reset from `/forgot-password`, and the verification email left over from the sign-up era. These carry no unsubscribe link.
- **Sender.** `info@moco-pickup.com`, set in `packages/email/src/sender.ts`. The address and the domain's DNS records are configured in Brevo.
- **Log.** Every list send writes one `email_send` row (kind, subject, recipient count, failures, Brevo message ids). `/admin/email` shows the last twenty.
- **Batching and personalisation.** One Brevo request carries up to 99 personalised copies (`messageVersions`), so a full list costs one or two subrequests. Each copy gets `params.name`, `params.unsubscribeUrl` and `params.key` — the last is what turns the shared template's links into that one person's sign-in links. Without `BREVO_API_KEY` the email is printed instead, with those placeholders filled in from the first recipient so the link in the console is clickable.
- **Brevo's own unsubscribe.** Brevo adds its own `List-Unsubscribe` header to every email (ours is replaced), so a player can also leave from the Unsubscribe button in their mail app. That puts them on Brevo's transactional blocklist, and Brevo tells the app through a webhook at `/api/brevo/webhook` (`apps/web/src/server/brevo-webhook.ts`), which flips the row to unsubscribed. Hard bounces, spam complaints and invalid addresses are dropped the same way. When an admin adds them back, the app removes them from Brevo's blocklist again.

Setting it up:

1. In Brevo, create a v3 API key (Account > SMTP & API > API keys).
2. Production: `pnpm --filter web exec wrangler secret put BREVO_API_KEY`.
3. Local sending (optional): put the same key in `apps/web/.dev.vars`.
4. The webhook: pick a random token, set it with `pnpm --filter web exec wrangler secret put BREVO_WEBHOOK_SECRET`, then register the webhook once (already done for the production account):

   ```bash
   curl -H "api-key: $BREVO_API_KEY" -H "content-type: application/json" https://api.brevo.com/v3/webhooks \
     -d '{"url":"https://moco-pickup.com/api/brevo/webhook","type":"transactional","events":["unsubscribed","hardBounce","spam","invalid"],"auth":{"type":"bearer","token":"<the token>"}}'
   ```

   Without the secret the route answers 404, so a missing webhook never breaks anything else.
5. To exercise the reminder job locally with the dev server running: `curl "http://localhost:3001/cdn-cgi/local/scheduled?cron=0+*+*+*+*"`.

The templates and Brevo client in `packages/email` are pure functions with tests: `pnpm run test`.

Brevo also offers an MCP server for inspecting the account (senders, templates, delivery logs) from Claude Code. Register it once per machine, outside the repo, with an MCP token from the same API keys page:

```bash
claude mcp add --transport http --scope user brevo https://mcp.brevo.com/v1/brevo/mcp --header "Authorization: Bearer <MCP token>"
```

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
   Set the Brevo key and webhook token the same way: `pnpm --filter web exec wrangler secret put BREVO_API_KEY` and `... put BREVO_WEBHOOK_SECRET` (see "Email").
4. Create the permit bucket: `pnpm --filter web exec wrangler r2 bucket create pickup-bball-permits`.
5. Apply migrations to production: `pnpm run db:migrate:remote`.
6. Deploy: `pnpm run deploy`.
7. Set `BETTER_AUTH_URL` in `apps/web/wrangler.jsonc` `vars` to the URL wrangler printed (or your custom domain) and deploy again.
8. Ask an existing admin to add your address on `/admin/email`, then promote yourself with the command in "Games, permits and admins". On a brand new database, insert the first `subscriber` row by hand.

### Automatic deploys

`.github/workflows/deploy.yml` runs on every push and pull request. It lints with Biome, runs the unit tests, typechecks and builds. On pushes to `main` it then applies pending D1 migrations and deploys the Worker with Cloudflare's `wrangler-action`.

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
│   ├── db/          # Drizzle schema (auth, game, permit, rsvp, subscriber, email_send) and D1 migrations
│   ├── email/       # Brevo client, email templates and their tests
│   └── env/         # Typed access to Worker env and bindings
```

## Available Scripts

- `pnpm run dev`: Start the dev server (pages and API) at http://localhost:3001
- `pnpm run build`: Build the Worker and static assets
- `pnpm run check-types`: Check TypeScript types across the workspace
- `pnpm run check`: Run Biome formatting and linting
- `pnpm run test`: Run the unit tests (email templates and Brevo client)
- `pnpm run db:generate`: Generate a D1 migration from the Drizzle schema
- `pnpm run db:migrate:local`: Apply migrations to the local D1 database
- `pnpm run db:migrate:remote`: Apply migrations to the production D1 database
- `pnpm run deploy`: Build and deploy the Worker with wrangler
