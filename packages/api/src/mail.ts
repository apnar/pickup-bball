import { emailSend } from "@pickup-bball/db/schema/email";
import { rsvp } from "@pickup-bball/db/schema/rsvp";
import {
	ensureLinkToken,
	listActiveSubscribers,
	markLinkSent,
} from "@pickup-bball/db/subscribers";
import type {
	ListRecipient,
	ListResult,
	Rendered,
	SendOutcome,
} from "@pickup-bball/email";
import {
	announcementEmail,
	messageEmail,
	reminderEmail,
	welcomeEmail,
} from "@pickup-bball/email";
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

/**
 * The concrete sign-in link for one person. Unlike the links inside list
 * templates, this one is not a Brevo placeholder: it goes into an email
 * addressed to exactly one subscriber.
 */
export function welcomeLinkUrl(token: string): string {
	return `${siteUrl()}/api/auth/link?k=${token}&to=%2F%23rsvp`;
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

export function renderMessage(input: {
	subject: string;
	body: string;
}): Rendered {
	return messageEmail({ ...input, siteUrl: siteUrl() });
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
		linkToken: s.linkToken,
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

/**
 * Send someone their way in: the welcome email, carrying their own sign-in
 * link. Used when an admin adds them, resends a link, or someone asks for
 * one from the login page.
 */
export async function sendWelcome(
	db: Db,
	subscriberId: string,
	person: { email: string; name: string | null },
): Promise<SendOutcome> {
	const token = await ensureLinkToken(db, subscriberId);
	const outcome = await getMailer().sendOne(
		{ email: person.email, name: person.name },
		welcomeEmail({ name: person.name, url: welcomeLinkUrl(token) }),
		{ tags: ["welcome"] },
	);
	if (outcome.ok) await markLinkSent(db, subscriberId);
	return outcome;
}
