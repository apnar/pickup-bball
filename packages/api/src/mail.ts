import { emailSend } from "@pickup-bball/db/schema/email";
import { rsvp } from "@pickup-bball/db/schema/rsvp";
import { listActiveSubscribers } from "@pickup-bball/db/subscribers";
import type { ListRecipient, ListResult, Rendered } from "@pickup-bball/email";
import { announcementEmail, reminderEmail } from "@pickup-bball/email";
import { getMailer, siteUrl } from "@pickup-bball/email/worker";
import { and, asc, eq } from "drizzle-orm";

import type { Context } from "./context";
import type { GameSummary } from "./games";
import { CAPACITY } from "./run";

type Db = Context["db"];

export type EmailKind = "announcement" | "reminder" | "message";

export type ListSendResult = ListResult & { sendId: string };

export function unsubscribeUrl(token: string): string {
	return `${siteUrl()}/api/unsubscribe/${token}`;
}

export function permitUrl(game: GameSummary): string | null {
	return game.permit ? `${siteUrl()}/api/permits/${game.permit.id}/file` : null;
}

export function renderAnnouncement(game: GameSummary): Rendered {
	return announcementEmail({
		dateLabel: game.dateLabel,
		timeLabel: game.timeLabel,
		location: game.location,
		notes: game.notes,
		permitUrl: permitUrl(game),
		siteUrl: siteUrl(),
		inCount: game.inCount,
		capacity: CAPACITY,
	});
}

export async function renderReminder(
	db: Db,
	game: GameSummary,
): Promise<Rendered> {
	const rows = await db
		.select({ name: rsvp.name })
		.from(rsvp)
		.where(and(eq(rsvp.gameId, game.id), eq(rsvp.isIn, true)))
		.orderBy(asc(rsvp.createdAt))
		.all();
	return reminderEmail({
		dateLabel: game.dateLabel,
		timeLabel: game.timeLabel,
		location: game.location,
		inCount: rows.length,
		capacity: CAPACITY,
		inNames: rows.map((r) => r.name),
		siteUrl: siteUrl(),
	});
}

/** How many people a list send would reach right now. */
export async function countRecipients(db: Db): Promise<number> {
	return (await listActiveSubscribers(db)).length;
}

/**
 * Send one rendered email to the active list (or a subset by id) and record
 * the outcome in `email_send`. Returns null when nobody would receive it.
 */
export async function sendToList(
	db: Db,
	opts: {
		kind: EmailKind;
		gameId?: string | null;
		rendered: Rendered;
		sentBy?: string | null;
		onlySubscriberIds?: string[];
	},
): Promise<ListSendResult | null> {
	let subscribers = await listActiveSubscribers(db);
	if (opts.onlySubscriberIds) {
		const wanted = new Set(opts.onlySubscriberIds);
		subscribers = subscribers.filter((s) => wanted.has(s.id));
	}
	if (subscribers.length === 0) return null;

	const recipients: ListRecipient[] = subscribers.map((s) => ({
		email: s.email,
		name: s.name,
		unsubscribeUrl: unsubscribeUrl(s.unsubscribeToken),
	}));
	const result = await getMailer().sendList(recipients, opts.rendered, {
		tags: [opts.kind],
	});
	const sendId = crypto.randomUUID();
	await db.insert(emailSend).values({
		id: sendId,
		kind: opts.kind,
		gameId: opts.gameId ?? null,
		subject: opts.rendered.subject,
		recipientCount: result.attempted,
		failedCount: result.attempted - result.sent,
		messageIds: JSON.stringify(result.messageIds),
		errors: JSON.stringify(result.failed),
		sentBy: opts.sentBy ?? null,
	});
	return { ...result, sendId };
}
