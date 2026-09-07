import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { game } from "./game";

/**
 * One row per name per game. Deleting a game removes its headcount.
 */
export const rsvp = sqliteTable(
	"rsvp",
	{
		id: text("id").primaryKey(),
		gameId: text("game_id")
			.notNull()
			.references(() => game.id, { onDelete: "cascade" }),
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
		uniqueIndex("rsvp_game_name_uidx").on(table.gameId, table.nameKey),
		index("rsvp_game_idx").on(table.gameId),
	],
);
