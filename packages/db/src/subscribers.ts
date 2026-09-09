import { and, asc, eq } from "drizzle-orm";

import type { createDb } from "./index";
import { type SubscriberSource, subscriber } from "./schema/email";

type Db = ReturnType<typeof createDb>;

/** The form every address is stored and looked up in. */
export function normalizeEmail(raw: string): string {
	return raw.trim().toLowerCase();
}

/** A fresh sign-in token: 32 hex characters, unguessable. */
export function newLinkToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type UpsertSubscriberInput = {
	email: string;
	name?: string | null;
	source: SubscriberSource;
	userId?: string | null;
	/**
	 * Whether an unsubscribed row should be switched back to active. True when
	 * the person asked again (site form) or an admin added them; false for the
	 * automatic sign-up hook, so a past opt-out is respected.
	 */
	reactivate: boolean;
};

/**
 * Add an address to the list or update the existing row. Never demotes an
 * active subscriber.
 */
export async function upsertSubscriber(
	db: Db,
	input: UpsertSubscriberInput,
): Promise<{
	id: string;
	created: boolean;
	status: "active" | "unsubscribed";
}> {
	const email = normalizeEmail(input.email);
	const name = input.name?.trim() || null;
	const existing = await db
		.select({
			id: subscriber.id,
			name: subscriber.name,
			status: subscriber.status,
			userId: subscriber.userId,
		})
		.from(subscriber)
		.where(eq(subscriber.email, email))
		.get();

	if (!existing) {
		const id = crypto.randomUUID();
		await db.insert(subscriber).values({
			id,
			email,
			name,
			status: "active",
			unsubscribeToken: crypto.randomUUID(),
			linkToken: newLinkToken(),
			source: input.source,
			userId: input.userId ?? null,
		});
		return { id, created: true, status: "active" };
	}

	const reactivating = input.reactivate && existing.status === "unsubscribed";
	await db
		.update(subscriber)
		.set({
			name: existing.name ?? name,
			userId: existing.userId ?? input.userId ?? null,
			...(reactivating && { status: "active", unsubscribedAt: null }),
		})
		.where(eq(subscriber.id, existing.id));
	return {
		id: existing.id,
		created: false,
		status: reactivating ? "active" : existing.status,
	};
}

export type ActiveSubscriber = {
	id: string;
	email: string;
	name: string | null;
	unsubscribeToken: string;
	linkToken: string | null;
};

/** Everyone who should get the next list email, oldest first. */
export async function listActiveSubscribers(
	db: Db,
): Promise<ActiveSubscriber[]> {
	return db
		.select({
			id: subscriber.id,
			email: subscriber.email,
			name: subscriber.name,
			unsubscribeToken: subscriber.unsubscribeToken,
			linkToken: subscriber.linkToken,
		})
		.from(subscriber)
		.where(eq(subscriber.status, "active"))
		.orderBy(asc(subscriber.createdAt))
		.all();
}

/** The sign-in token for a subscriber, generating one if the row predates them. */
export async function ensureLinkToken(db: Db, id: string): Promise<string> {
	const row = await db
		.select({ linkToken: subscriber.linkToken })
		.from(subscriber)
		.where(eq(subscriber.id, id))
		.get();
	if (row?.linkToken) return row.linkToken;
	const token = newLinkToken();
	await db
		.update(subscriber)
		.set({ linkToken: token })
		.where(eq(subscriber.id, id));
	return token;
}

export type LinkSubscriber = {
	id: string;
	email: string;
	name: string | null;
	status: "active" | "unsubscribed";
	userId: string | null;
};

/** Who a sign-in link belongs to. Null when the token means nothing. */
export async function findSubscriberByLinkToken(
	db: Db,
	token: string,
): Promise<LinkSubscriber | null> {
	const row = await db
		.select({
			id: subscriber.id,
			email: subscriber.email,
			name: subscriber.name,
			status: subscriber.status,
			userId: subscriber.userId,
		})
		.from(subscriber)
		.where(eq(subscriber.linkToken, token))
		.get();
	return row ?? null;
}

/** Point a subscriber row at the account it belongs to. Idempotent. */
export async function attachSubscriberUser(
	db: Db,
	id: string,
	userId: string,
): Promise<void> {
	await db.update(subscriber).set({ userId }).where(eq(subscriber.id, id));
}

/** An address that is still on the list, by email. */
export async function findActiveSubscriberByEmail(
	db: Db,
	email: string,
): Promise<{ id: string; linkSentAt: Date | null } | null> {
	const row = await db
		.select({ id: subscriber.id, linkSentAt: subscriber.linkSentAt })
		.from(subscriber)
		.where(
			and(
				eq(subscriber.email, normalizeEmail(email)),
				eq(subscriber.status, "active"),
			),
		)
		.get();
	return row ?? null;
}

/** Record that a sign-in link just went out, for the request cooldown. */
export async function markLinkSent(db: Db, id: string): Promise<void> {
	await db
		.update(subscriber)
		.set({ linkSentAt: new Date() })
		.where(eq(subscriber.id, id));
}

/** Take the owner of a token off the list. Null when the token is unknown. */
export async function unsubscribeByToken(
	db: Db,
	token: string,
): Promise<{ email: string } | null> {
	const row = await db
		.select({ id: subscriber.id, email: subscriber.email })
		.from(subscriber)
		.where(eq(subscriber.unsubscribeToken, token))
		.get();
	if (!row) return null;
	await db
		.update(subscriber)
		.set({ status: "unsubscribed", unsubscribedAt: new Date() })
		.where(and(eq(subscriber.id, row.id), eq(subscriber.status, "active")));
	return { email: row.email };
}

/** Take an address off the list (Brevo webhook: unsubscribed, bounced, spam). */
export async function unsubscribeByEmail(
	db: Db,
	email: string,
): Promise<boolean> {
	const result = await db
		.update(subscriber)
		.set({ status: "unsubscribed", unsubscribedAt: new Date() })
		.where(
			and(
				eq(subscriber.email, normalizeEmail(email)),
				eq(subscriber.status, "active"),
			),
		)
		.run();
	return result.meta.changes === 1;
}

/** Undo an unsubscribe from the confirmation page. */
export async function resubscribeByToken(
	db: Db,
	token: string,
): Promise<{ email: string } | null> {
	const row = await db
		.select({ id: subscriber.id, email: subscriber.email })
		.from(subscriber)
		.where(eq(subscriber.unsubscribeToken, token))
		.get();
	if (!row) return null;
	await db
		.update(subscriber)
		.set({ status: "active", unsubscribedAt: null })
		.where(eq(subscriber.id, row.id));
	return { email: row.email };
}

/** Set a signed-in user's own subscription on or off, creating the row if needed. */
export async function setSubscriptionForUser(
	db: Db,
	input: { userId: string; email: string; name: string; subscribed: boolean },
): Promise<void> {
	if (input.subscribed) {
		await upsertSubscriber(db, {
			email: input.email,
			name: input.name,
			source: "site",
			userId: input.userId,
			reactivate: true,
		});
		return;
	}
	const email = normalizeEmail(input.email);
	await db
		.update(subscriber)
		.set({ status: "unsubscribed", unsubscribedAt: new Date() })
		.where(eq(subscriber.email, email));
}

/** The subscription row that belongs to a signed-in user, by link or by address. */
export async function findSubscriptionForUser(
	db: Db,
	input: { userId: string; email: string },
) {
	const byUser = await db
		.select({ id: subscriber.id, status: subscriber.status })
		.from(subscriber)
		.where(eq(subscriber.userId, input.userId))
		.get();
	if (byUser) return byUser;
	return db
		.select({ id: subscriber.id, status: subscriber.status })
		.from(subscriber)
		.where(eq(subscriber.email, normalizeEmail(input.email)))
		.get();
}
