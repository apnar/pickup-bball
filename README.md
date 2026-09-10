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

Nobody signs themselves up. Public sign-up is closed (`emailAndPassword.disableSignUp`), and there is no join form. An admin adds an address on `/admin/users`, the welcome email goes out, and **every link in every email that person gets is unique to them and signs them in when clicked**. That link is a bearer token, which is why the emails say not to forward it. The one exception is the permit PDF: it is meant to be waved at gym staff, so its URL carries nothing.

Sessions last 180 days and roll forward. The session cookie caches the user for five minutes, so ordinary navigation costs no database read — and a role changed by SQL takes up to five minutes to show up.

**One list, three states.** There is a single table of people — `user` — and it is the roster, the mailing list and the accounts all at once. Every person is in exactly one state, shown and changed on `/admin/users`:

| | Gets email | Can sign in | Can take a spot | Who sets it | Ends how |
|---|---|---|---|---|---|
| **Active** | yes | yes | yes | — | — |
| **Suspended** | only on an explicit "everyone" send | yes | no | the person, or an admin | on its own date, or "I'm back" |
| **Deactivated** | never | no | no | **an admin** | an admin |

Both non-active states carry a reason and record who set them; a suspension can also carry a return date. There is no unsubscribe that leaves somebody on the roster: email is how this group talks, so stepping away from the email is stepping away from the Mondays, and it is temporary by default because the usual cause is a torn calf. A suspension is stored as `status = 'suspended'` plus `suspended_until`, and **a date in the past already counts as active** — `effectiveStatus` in `packages/db/src/people.ts` decides, so nobody is stranded by a cron that did not run. The hourly job only tidies the row.

Losing access is deactivation, and only that: it is the one thing that sets Better Auth's `banned` (in the same statement, so the framework closes the password door), revokes every session, and makes the person's emailed links redirect to `/login?error=revoked`. Nothing is ever deleted, and an admin can undo it. Note the five-minute session cookie cache: a just-deactivated player who is already signed in keeps ordinary navigation working until it expires, though every RSVP action re-checks the database and refuses immediately.

Passwords are optional. Password sign-in is still the default form on `/login` (admins use it), and any player can set one from `/dashboard`; the emailed links keep working either way. Below the sign-in form, "Email me my link" mails a fresh one to any address on the list, at most once every ten minutes, and says the same thing whether or not the address is on it.

## Games, permits and admins

A game exists only once a gym has been rented. Admins keep the list of courts, book games on them and file the permit PDFs; players see the schedule and the next game's headcount.

- **Admins** are accounts with `role = 'admin'` (Better Auth's admin plugin). Promote the first one with a SQL command, then use the Users tab on `/admin` to promote others:

```bash
pnpm --filter web exec wrangler d1 execute DB --remote --command "update user set role='admin' where email='you@example.com'"
```

  Drop `--remote` to do the same against the local database. The role is read from the session cookie cache, so it takes up to five minutes to apply; signing out and back in is quicker.

- **The first account on an empty database** cannot come from the site: sign-up is closed and adding people needs an admin. Write your own row, then click your own link. Nothing else is a special case; this is the ordinary join, done with SQL instead of the admin page — and because people and accounts are one table now, you can make yourself an admin in the same statement.

```bash
# 1. Put yourself on the list, as an admin, with a token to get in with.
pnpm --filter web exec wrangler d1 execute DB --remote --command "insert into user (id, name, email, email_verified, role, status, source, link_token, unsubscribe_token) values (lower(hex(randomblob(16))), 'Your Name', 'you@example.com', 1, 'admin', 'active', 'admin', lower(hex(randomblob(16))), lower(hex(randomblob(16))))"

# 2. Read the token back.
pnpm --filter web exec wrangler d1 execute DB --remote --command "select link_token from user where email='you@example.com'"
```

  Open `https://moco-pickup.com/api/auth/link?k=<that token>`. It signs you in, and is the same link the welcome email would have carried. Then add everyone else from `/admin/users`.
- **Gyms** live in the `gym` table (name, address, notes) and are managed on `/admin/gyms`. A court is written down once -- the address, and the "park by the back lot, the side door is the open one" that used to live in somebody's texts -- and every game, email and permit reads the same answer. Both are shown to players with the game, so the address is in the email they read in the car.
- **Games** live in the `game` table (date, tip-off, `gym_id`, notes, optional permit). Admins manage them on `/admin`, where the court is a dropdown that defaults to **the gym booked most recently**, because the next game is nearly always at the last one. A game cannot exist without a gym (`gym_id` is NOT NULL), and a gym with games on it cannot be deleted until they are moved or gone. The home page shows the next game on or after today; `/schedule` lists upcoming and recent games. Both are players-only.
- **Permits** are PDFs stored in the `PERMITS` R2 bucket (`pickup-bball-permits`) with a row in the `permit` table. Admins upload them on `/admin/permits` and attach them to games. On upload they also tick **which courts the permit covers** -- one piece of paper from the county often rents two gyms -- which is a set of rows in `permit_gym` and can be re-ticked later from the Courts button on any permit. Coverage is paperwork, not a booking: it sorts the permit dropdown when an admin books a game, and nothing more. Anyone with the link can open `/api/permits/<id>/file` (add `?download=1` to download), so a permit can be shown to gym staff from any phone.
- **Headcount** rows in `rsvp` belong to a game (`game_id`). A player taps "I'm in as {name}" to put themselves on the sheet (`rsvp.addMe`, which claims the row by `user_id` and marks it "you"), and can type a friend's name in as well. Deleting a game deletes its headcount.

The oRPC procedures are `account.*`, `games.*`, `gyms.*`, `permits.*`, `rsvp.*`, `people.*` and `mail.*` under `packages/api/src/routers`. Admin-only procedures use `adminProcedure` from `packages/api/src/index.ts`; `games.*` and `rsvp.*` reads are `protectedProcedure`, so a stranger gets UNAUTHORIZED rather than the address of the gym. Roster, rules and game conditions remain plain content in `apps/web/src/content/run.ts`.

## Email

Players hear about games by email, and get in through the links in them. Brevo delivers; the app owns the list, the templates and the log.

- **Who gets it.** The `user` table — the same rows that decide who is a player, because there is only one list. Admins add people on `/admin/users` (`source = 'admin'`); older rows came from the site form (`site`) and the old public sign-up (`signup`). Each person has an `unsubscribe_token` for the footer link and a `link_token` for the sign-in links, both plain text (they ride in every email anyway) and both stamped by the `user.create` hook, so nobody can exist without a way in.
- **Which audience.** Game announcements and game-day reminders always go to **active** people only; somebody nursing a calf does not need a 9 AM headcount. The ad-hoc message on `/admin/email` offers **Active** (default) or **Everyone**, where Everyone also reaches people on a break. Neither audience ever includes anybody deactivated. `email_send.audience` records which was used. The one query behind all of it is `listRecipients` in `packages/db/src/people.ts`.
- **Stepping away.** The footer of every list email links to `/api/unsubscribe/<token>`, which no longer unsubscribes anybody on sight — it shows a form asking for how long and why, and only the POST acts. (That also fixes a real bug: mail clients prefetch link targets, which used to unsubscribe people who never clicked.) A mail client's own one-click `List-Unsubscribe-Post` sends no form at all, so it lands as an open-ended break. Players can do the same thing from `/dashboard` or straight from the RSVP board, and come back from any of them in one tap.
- **How a link signs you in.** Every link in a list email points at `/api/auth/link?k=<link_token>&to=<path>`, a GET endpoint added by the `email-link` plugin in `packages/auth/src/link.ts`. It finds the person, marks an unverified address verified, opens a session and redirects to `to` — which is checked by `safeReturnPath` and falls back to `/` for anything that points off this site. An unknown token lands on `/login?error=link`, a deactivated one on `/login?error=revoked`. That check is written out here rather than left to the admin plugin: this endpoint mints its own session, so it is the thing standing between a revoked player and the gym address.
- **What goes out.**
  - *Welcome* — when an admin adds someone, or resends their link from `/admin/users`, or a player asks for one from `/login`. Carries their concrete sign-in link, no list footer. Somebody on a break can still ask for one: getting back in is how they come back.
  - *Announcement* — when a gym is booked. Manual: on `/admin/email`, preview the email for the game, then send. The game records `announced_at`. Individual people can be sent it again from `/admin/users`.
  - *Reminder* — the morning of a game, with the current headcount and who is In. Sent by the hourly Cron Trigger once it is 9 AM Eastern (`REMINDER_LOCAL_HOUR` in `packages/api/src/jobs/reminders.ts`), at most once per game (`game.reminder_sent_at` is the lock). Admins can also send it early from `/admin/email`.
  - *Message* — anything an admin types on `/admin/email`. "Send to me first" delivers a test copy to the signed-in admin only, with their own token substituted so the links are real.
  - *Account* — Better Auth's password reset from `/forgot-password`, and the verification email left over from the sign-up era. These carry no unsubscribe link.
- **Sender.** `info@moco-pickup.com`, set in `packages/email/src/sender.ts`. The address and the domain's DNS records are configured in Brevo.
- **Log.** Every list send writes one `email_send` row (kind, subject, recipient count, failures, Brevo message ids). `/admin/email` shows the last twenty.
- **Batching and personalisation.** One Brevo request carries up to 99 personalised copies (`messageVersions`), so a full list costs one or two subrequests. Each copy gets `params.name`, `params.unsubscribeUrl` and `params.key` — the last is what turns the shared template's links into that one person's sign-in links. Without `BREVO_API_KEY` the email is printed instead, with those placeholders filled in from the first recipient so the link in the console is clickable.
- **Brevo's own unsubscribe.** Brevo adds its own `List-Unsubscribe` header to every email (ours is replaced), so a player can also stop the mail from the Unsubscribe button in their mail app. That puts them on Brevo's transactional blocklist, and Brevo tells the app through a webhook at `/api/brevo/webhook` (`apps/web/src/server/brevo-webhook.ts`). All four events — unsubscribe, hard bounce, spam complaint, invalid address — put the person on an **open-ended break**, never a deactivation: not being able to reach somebody is not grounds for throwing them out, and only an admin does that. The reason is written for them ("Email is bouncing.") so the admin page shows it came from Brevo and not from them, and only somebody currently active is touched, so a repeat event cannot clobber a reason they wrote themselves. Every path back — the admin page, the dashboard, the email footer's undo — lifts Brevo's blocklist too, or they would read as active and be quietly undeliverable.

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
8. Get yourself an account: on a brand new database, follow "The first account on an empty database" in "Games, permits and admins". Otherwise ask an existing admin to add your address on `/admin/email` and click the link they send you.

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
│   ├── db/          # Drizzle schema (auth/people, gym, game, permit, rsvp, email_send) and D1 migrations
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
