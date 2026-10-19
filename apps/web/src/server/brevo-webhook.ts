import { createDb } from "@pickup-bball/db";
import { suspendByEmail } from "@pickup-bball/db/people";
import { env } from "@pickup-bball/env/server";
import { Hono } from "hono";

/**
 * Brevo transactional webhook. Brevo adds its own List-Unsubscribe header to
 * every email, so people can stop the mail from their mail app without ever
 * touching the site; this keeps the roster in step with that, and also drops
 * addresses that bounce hard or mark us as spam.
 *
 * All of it lands as an open-ended break, never a deactivation: not being
 * able to reach somebody is not grounds for throwing them out of the group,
 * and only an admin does that anyway. The reason says what happened so it is
 * obvious on the admin page that this was Brevo and not the person.
 *
 * Registered with `auth: { type: "bearer", token: BREVO_WEBHOOK_SECRET }`
 * (see README "Email"). Events arrive one per request, or as an array when
 * the webhook was created with `batched: true`.
 */
export const brevoWebhook = new Hono();

/** Payload `event` values that mean "stop emailing this address", and why. */
const DROP_EVENTS = new Map([
	["unsubscribed", "Unsubscribed from their mail app."],
	["hard_bounce", "Email is bouncing."],
	["spam", "Marked us as spam."],
	["invalid_email", "Address is not valid."],
]);

type BrevoEvent = { event?: string; email?: string; reason?: string };

/**
 * Constant-time comparison. A `!==` on a secret returns the moment the first
 * byte differs, and the Worker's response time would say how many bytes a
 * guess got right. Every byte is visited whatever the input; the length is
 * the one thing this gives away, and the length is not the secret. Written
 * out rather than `crypto.subtle.timingSafeEqual` because the Workers types
 * this repo pins do not declare it.
 */
function sameSecret(given: string, expected: string): boolean {
	const a = new TextEncoder().encode(given);
	const b = new TextEncoder().encode(expected);
	let diff = a.byteLength ^ b.byteLength;
	for (let i = 0; i < b.byteLength; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}

brevoWebhook.post("/", async (c) => {
	const secret = env.BREVO_WEBHOOK_SECRET;
	if (!secret) return c.text("Not found.", 404);
	const auth = c.req.header("authorization") ?? "";
	if (!sameSecret(auth, `Bearer ${secret}`)) {
		return c.text("Forbidden.", 403);
	}

	let payload: unknown;
	try {
		payload = await c.req.json();
	} catch {
		return c.text("Bad JSON.", 400);
	}
	const events = (Array.isArray(payload) ? payload : [payload]).filter(
		(e): e is BrevoEvent => typeof e === "object" && e !== null,
	);

	const db = createDb();
	let dropped = 0;
	for (const e of events) {
		const reason = e.event ? DROP_EVENTS.get(e.event) : undefined;
		if (!e.email || !reason) continue;
		// Only somebody currently active, so a repeat event cannot clobber a
		// reason they wrote themselves.
		if (await suspendByEmail(db, e.email, { reason })) {
			dropped++;
			console.log(`brevo webhook: ${e.event} -> break for ${e.email}`);
		}
	}
	return c.json({ received: events.length, dropped });
});
