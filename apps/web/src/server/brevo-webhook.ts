import { createDb } from "@pickup-bball/db";
import { unsubscribeByEmail } from "@pickup-bball/db/subscribers";
import { env } from "@pickup-bball/env/server";
import { Hono } from "hono";

/**
 * Brevo transactional webhook. Brevo adds its own List-Unsubscribe header
 * to every email, so people can leave through their mail app without ever
 * touching the site; this keeps the `subscriber` table in step with that,
 * and also drops addresses that bounce hard or mark us as spam.
 *
 * Registered with `auth: { type: "bearer", token: BREVO_WEBHOOK_SECRET }`
 * (see README "Email"). Events arrive one per request, or as an array when
 * the webhook was created with `batched: true`.
 */
export const brevoWebhook = new Hono();

/** Payload `event` values that mean "stop emailing this address". */
const DROP_EVENTS = new Set([
	"unsubscribed",
	"hard_bounce",
	"spam",
	"invalid_email",
]);

type BrevoEvent = { event?: string; email?: string; reason?: string };

brevoWebhook.post("/", async (c) => {
	const secret = env.BREVO_WEBHOOK_SECRET;
	if (!secret) return c.text("Not found.", 404);
	const auth = c.req.header("authorization") ?? "";
	if (auth !== `Bearer ${secret}`) return c.text("Forbidden.", 403);

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
		if (!e.email || !e.event || !DROP_EVENTS.has(e.event)) continue;
		if (await unsubscribeByEmail(db, e.email)) {
			dropped++;
			console.log(`brevo webhook: ${e.event} -> unsubscribed ${e.email}`);
		}
	}
	return c.json({ received: events.length, dropped });
});
