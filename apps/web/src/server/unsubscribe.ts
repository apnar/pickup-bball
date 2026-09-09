import { createDb } from "@pickup-bball/db";
import {
	resubscribeByToken,
	unsubscribeByToken,
} from "@pickup-bball/db/subscribers";
import { escapeHtml, layout } from "@pickup-bball/email";
import { getMailer } from "@pickup-bball/email/worker";
import { Hono } from "hono";

const CTA =
	"display:inline-block; padding:12px 20px; background:#2f5f86; color:#ffffff; border:0; font-weight:700; font-size:15px; cursor:pointer;";
const P = "margin:0 0 14px; font-size:16px; line-height:1.5;";

function page(input: {
	heading: string;
	body: string;
	form?: { action: string; label: string };
	home: string;
}) {
	const form = input.form
		? `<form method="post" action="${escapeHtml(input.form.action)}" style="margin:20px 0 6px;"><button type="submit" style="${CTA}">${escapeHtml(input.form.label)}</button></form>`
		: "";
	return layout({
		title: input.heading,
		kicker: "Mailing list",
		heading: input.heading,
		bodyHtml: `<p style="${P}">${input.body}</p>${form}<p style="${P} color:#5f5f5f; font-size:14px;"><a href="${escapeHtml(input.home)}" style="color:#2f5f86;">Back to the site</a></p>`,
	});
}

function html(body: string, status: 200 | 404 = 200) {
	return new Response(body, {
		status,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
		},
	});
}

/**
 * Unsubscribe links from list emails land here. They must work from a plain
 * tap in a mail app with no JavaScript, so the GET does the work and offers
 * an undo. The POST is for mail clients that honour List-Unsubscribe-Post.
 */
export const unsubscribe = new Hono();

unsubscribe.get("/:token", async (c) => {
	const token = c.req.param("token");
	const home = new URL("/", c.req.url).toString();
	const db = createDb();
	const back = c.req.query("back") === "1";
	const row = back
		? await resubscribeByToken(db, token)
		: await unsubscribeByToken(db, token);
	if (!row) {
		return html(
			page({
				heading: "That link is not on the sheet.",
				body: "It may have been for an address that was removed. Nothing changed.",
				home,
			}),
			404,
		);
	}
	if (back) {
		return html(
			page({
				heading: "Back on the list.",
				body: `${escapeHtml(row.email)} will get the Monday night emails again. Welcome back; the ball is still Sean's.`,
				home,
			}),
		);
	}
	return html(
		page({
			heading: "You're off the list.",
			body: `${escapeHtml(row.email)} will not get any more game emails. No hard feelings; the group chat still works.`,
			form: { action: `/api/unsubscribe/${token}/undo`, label: "Put me back" },
			home,
		}),
	);
});

// RFC 8058 one-click unsubscribe from mail clients.
unsubscribe.post("/:token", async (c) => {
	const row = await unsubscribeByToken(createDb(), c.req.param("token"));
	return c.text(row ? "Unsubscribed." : "Unknown token.", row ? 200 : 404);
});

unsubscribe.post("/:token/undo", async (c) => {
	const token = c.req.param("token");
	const row = await resubscribeByToken(createDb(), token);
	if (!row) return c.text("Unknown token.", 404);
	await getMailer().unblock(row.email);
	return c.redirect(`/api/unsubscribe/${token}?back=1`, 303);
});
