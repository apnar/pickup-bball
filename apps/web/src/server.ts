import { runRsvpCycle } from "@pickup-bball/api/jobs/rsvp-cycle";
import { createDb } from "@pickup-bball/db";
import { sweepExpiredSuspensions } from "@pickup-bball/db/people";
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

/**
 * Headers every response carries. No Content-Security-Policy yet: the
 * hydration script is inline and would need a nonce threaded through the
 * TanStack shell, and a report-only policy with nowhere to report to is a
 * header that does nothing.
 */
function harden(response: Response): Response {
	const out = new Response(response.body, response);
	const h = out.headers;
	if (canonical.protocol === "https:") {
		h.set("strict-transport-security", "max-age=31536000; includeSubDomains");
	}
	h.set("x-content-type-options", "nosniff");
	// Sign-in links drop people on pages whose URL is theirs alone; the origin
	// is all another site ever learns about where they came from.
	h.set("referrer-policy", "strict-origin-when-cross-origin");
	// Nothing here is meant to be framed, least of all the sheet.
	h.set("x-frame-options", "DENY");
	h.set("content-security-policy", "frame-ancestors 'none'");
	h.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
	return out;
}

const entry = createServerEntry({
	async fetch(request, requestOpts) {
		const url = new URL(request.url);
		if (url.host !== canonical.host) {
			url.protocol = canonical.protocol;
			url.host = canonical.host;
			return Response.redirect(url.toString(), 301);
		}
		return harden(await handler.fetch(request, requestOpts));
	},
});

export default {
	fetch: entry.fetch,

	/**
	 * Cron Trigger (wrangler.jsonc `triggers.crons`, every half hour). Runs
	 * the RSVP cycle -- the five emails and the 7:30 verdict, all of it
	 * described on /admin/cycle -- and tidies suspensions that have run out.
	 * Test locally with
	 * `curl "http://localhost:3001/cdn-cgi/local/scheduled?cron=0+*+*+*+*"`.
	 */
	async scheduled(
		controller: { scheduledTime: number; cron: string },
		_env: unknown,
		ctx: { waitUntil(promise: Promise<unknown>): void },
	) {
		const now = new Date(controller.scheduledTime);
		ctx.waitUntil(
			runRsvpCycle(createDb(), now).then(
				(result) => console.log("rsvp cycle", JSON.stringify(result)),
				(error) => console.error("rsvp cycle failed", error),
			),
		);
		// Housekeeping only: an expired suspension already counts as active
		// everywhere it matters, so a missed run costs nothing but a stale
		// "until <a date last month>" on the admin page.
		ctx.waitUntil(
			sweepExpiredSuspensions(createDb(), now).then(
				(count) => count > 0 && console.log(`suspensions expired: ${count}`),
				(error) => console.error("suspension sweep failed", error),
			),
		);
	},
};
