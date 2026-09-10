import {
	type Audience,
	ensureLinkToken,
	ensureUnsubscribeToken,
	listRecipients,
	markLinkSent,
} from "@pickup-bball/db/people";
import { emailSend } from "@pickup-bball/db/schema/email";
import { rsvp } from "@pickup-bball/db/schema/rsvp";
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

/** How many people a send of this audience would reach right now. */
export async function countRecipients(
	db: Db,
	audience: Audience = "active",
): Promise<number> {
	return (await listRecipients(db, audience)).length;
}

/** Both numbers at once, for the audience picker. */
export async function recipientCounts(
	db: Db,
): Promise<{ active: number; everyone: number }> {
	const [active, everyone] = await Promise.all([
		countRecipients(db, "active"),
		countRecipients(db, "everyone"),
	]);
	return { active, everyone };
}

/**
 * Send one rendered email to the list (or a subset by id) and record the
 * outcome in `email_send`. Returns null when nobody would receive it.
 *
 * `audience` defaults to "active", which is what game email always wants:
 * somebody nursing a calf does not need to hear that a gym is booked. Only
 * the ad-hoc message ever passes "everyone", and nothing reaches anybody
 * deactivated -- `listRecipients` will not return them at all.
 */
export async function sendToList(
	db: Db,
	opts: {
		kind: EmailKind;
		gameId?: string | null;
		rendered: Rendered;
		sentBy?: string | null;
		audience?: Audience;
		onlyPersonIds?: string[];
	},
): Promise<ListSendResult | null> {
	const audience = opts.audience ?? "active";
	let people = await listRecipients(db, audience);
	if (opts.onlyPersonIds) {
		const wanted = new Set(opts.onlyPersonIds);
		people = people.filter((p) => wanted.has(p.id));
	}
	if (people.length === 0) return null;

	const recipients: ListRecipient[] = people.map((p) => ({
		email: p.email,
		name: p.name,
		unsubscribeUrl: unsubscribeUrl(p.unsubscribeToken ?? ""),
		linkToken: p.linkToken,
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
		audience,
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
	userId: string,
	person: { email: string; name: string | null },
): Promise<SendOutcome> {
	const token = await ensureLinkToken(db, userId);
	const outcome = await getMailer().sendOne(
		{ email: person.email, name: person.name },
		welcomeEmail({ name: person.name, url: welcomeLinkUrl(token) }),
		{ tags: ["welcome"] },
	);
	if (outcome.ok) await markLinkSent(db, userId);
	return outcome;
}

/** The pair of tokens a one-off personalised send needs. */
export async function tokensFor(
	db: Db,
	userId: string,
): Promise<{ key: string; unsubscribeUrl: string }> {
	const [key, token] = await Promise.all([
		ensureLinkToken(db, userId),
		ensureUnsubscribeToken(db, userId),
	]);
	return { key, unsubscribeUrl: unsubscribeUrl(token) };
}
