import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { game } from "./game";

export const SUBSCRIBER_SOURCES = ["site", "admin", "signup"] as const;
export type SubscriberSource = (typeof SUBSCRIBER_SOURCES)[number];

export const EMAIL_KINDS = ["announcement", "reminder", "message"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** Someone who gets the list emails. One row per address, kept after opting out. */
export const subscriber = sqliteTable(
	"subscriber",
	{
		id: text("id").primaryKey(),
		/** Trimmed and lower-cased before every insert and lookup. */
		email: text("email").notNull().unique(),
		name: text("name"),
		status: text("status", { enum: ["active", "unsubscribed"] })
			.notNull()
			.default("active"),
		unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp_ms" }),
		/** Random token in every unsubscribe link. */
		unsubscribeToken: text("unsubscribe_token").notNull().unique(),
		/**
		 * Random token in every other link we email this person. Clicking one
		 * signs them in, so it is a bearer token: never put it on a permit URL.
		 * Nullable only because SQLite cannot add a NOT NULL unique column; the
		 * code treats null as "generate one now".
		 */
		linkToken: text("link_token").unique(),
		/** When the last sign-in link was emailed, for the request cooldown. */
		linkSentAt: integer("link_sent_at", { mode: "timestamp_ms" }),
		source: text("source", { enum: SUBSCRIBER_SOURCES }).notNull(),
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("subscriber_user_idx").on(table.userId),
		index("subscriber_status_idx").on(table.status),
	],
);

/** One row per list send (not per recipient), for the admin log and debugging. */
export const emailSend = sqliteTable(
	"email_send",
	{
		id: text("id").primaryKey(),
		kind: text("kind", { enum: EMAIL_KINDS }).notNull(),
		gameId: text("game_id").references(() => game.id, {
			onDelete: "set null",
		}),
		subject: text("subject").notNull(),
		recipientCount: integer("recipient_count").notNull(),
		failedCount: integer("failed_count").notNull().default(0),
		/** JSON array of Brevo message ids, one per batch. */
		messageIds: text("message_ids").notNull().default("[]"),
		/** JSON array of { emails, error } for batches Brevo rejected. */
		errors: text("errors").notNull().default("[]"),
		sentBy: text("sent_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [index("email_send_game_idx").on(table.gameId)],
);
