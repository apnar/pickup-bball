import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { permit } from "./permit";

/** A booked run. Only exists once a gym has been rented. */
export const game = sqliteTable(
	"game",
	{
		id: text("id").primaryKey(),
		/** YYYY-MM-DD in the gym's timezone. */
		date: text("date").notNull(),
		/** HH:MM, 24-hour. */
		startTime: text("start_time").notNull(),
		endTime: text("end_time"),
		location: text("location").notNull(),
		notes: text("notes"),
		permitId: text("permit_id").references(() => permit.id, {
			onDelete: "set null",
		}),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		/** When an admin emailed the list about this game. */
		announcedAt: integer("announced_at", { mode: "timestamp_ms" }),
		/** Set by the game-day reminder job; also its once-only lock. */
		reminderSentAt: integer("reminder_sent_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("game_date_time_uidx").on(table.date, table.startTime),
		index("game_date_idx").on(table.date),
	],
);
