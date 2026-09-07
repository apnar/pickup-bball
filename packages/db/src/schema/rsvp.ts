import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

/**
 * One row per name per week. `weekOf` is the ISO date (YYYY-MM-DD) of the
 * Monday the row belongs to, so past weeks stay as history and the board
 * starts empty every week.
 */
export const rsvp = sqliteTable(
	"rsvp",
	{
		id: text("id").primaryKey(),
		weekOf: text("week_of").notNull(),
		name: text("name").notNull(),
		/** Lower-cased, whitespace-collapsed name used for uniqueness. */
		nameKey: text("name_key").notNull(),
		isIn: integer("is_in", { mode: "boolean" }).notNull().default(true),
		/** Set when the person was signed in when they added the name. */
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
		uniqueIndex("rsvp_week_name_uidx").on(table.weekOf, table.nameKey),
		index("rsvp_week_idx").on(table.weekOf),
	],
);
