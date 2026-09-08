import { sendDueReminders } from "@pickup-bball/api/jobs/reminders";
import { createDb } from "@pickup-bball/db";
import { env } from "@pickup-bball/env/server";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

/**
 * Custom server entry. TanStack Start picks this up automatically in place
 * of its default one, and the Cloudflare Vite plugin ships its default
 * export as the Worker module, which is why `scheduled` can live here too.
 *
 * The site answers on several hosts (moco-pickup.com, www.moco-pickup.com
 * and the workers.dev URL) but Better Auth only trusts BETTER_AUTH_URL, so
 * every other host gets a permanent redirect to the canonical origin.
 */
const canonical = new URL(env.BETTER_AUTH_URL);

const entry = createServerEntry({
	async fetch(request, requestOpts) {
		const url = new URL(request.url);
		if (url.host !== canonical.host) {
			url.protocol = canonical.protocol;
			url.host = canonical.host;
			return Response.redirect(url.toString(), 301);
		}
		return handler.fetch(request, requestOpts);
	},
});

export default {
	fetch: entry.fetch,

	/**
	 * Cron Trigger (wrangler.jsonc `triggers.crons`, hourly). Sends the
	 * game-day reminder once it is morning at the gym. Test locally with
	 * `curl "http://localhost:3001/cdn-cgi/local/scheduled?cron=0+*+*+*+*"`.
	 */
	async scheduled(
		controller: { scheduledTime: number; cron: string },
		_env: unknown,
		ctx: { waitUntil(promise: Promise<unknown>): void },
	) {
		ctx.waitUntil(
			sendDueReminders(createDb(), new Date(controller.scheduledTime)).then(
				(result) => console.log("reminders", JSON.stringify(result)),
				(error) => console.error("reminders failed", error),
			),
		);
	},
};
