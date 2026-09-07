import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

/** A gym rental permit PDF, stored in the PERMITS R2 bucket under `r2Key`. */
export const permit = sqliteTable("permit", {
	id: text("id").primaryKey(),
	/** Shown on the schedule, e.g. "Shady Grove, Sep 14 - 28". */
	label: text("label").notNull(),
	r2Key: text("r2_key").notNull(),
	fileName: text("file_name").notNull(),
	contentType: text("content_type").notNull(),
	size: integer("size").notNull(),
	uploadedBy: text("uploaded_by").references(() => user.id, {
		onDelete: "set null",
	}),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});
