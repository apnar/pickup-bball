import { ORPCError } from "@orpc/server";
import { rsvp } from "@pickup-bball/db/schema/rsvp";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { publicProcedure } from "../index";
import { CAPACITY, currentWeekOf, formatWeekOf, nameKeyOf } from "../run";

const nameSchema = z
	.string()
	.trim()
	.min(1, "Put a name in.")
	.max(40, "That is not a name, that is a paragraph.");

async function listWeek(db: Context["db"], weekOf: string) {
	const rows = await db
		.select({ id: rsvp.id, name: rsvp.name, isIn: rsvp.isIn })
		.from(rsvp)
		.where(eq(rsvp.weekOf, weekOf))
		.orderBy(asc(rsvp.createdAt));
	return {
		weekOf,
		weekLabel: formatWeekOf(weekOf),
		capacity: CAPACITY,
		rsvps: rows,
	};
}

export type Headcount = Awaited<ReturnType<typeof listWeek>>;

export const rsvpRouter = {
	/** This week's headcount. */
	list: publicProcedure.handler(({ context }) =>
		listWeek(context.db, currentWeekOf()),
	),

	/** Put a name in for this week. An existing name is flipped back to In. */
	add: publicProcedure
		.input(z.object({ name: nameSchema }))
		.handler(async ({ context, input }) => {
			const weekOf = currentWeekOf();
			const name = input.name.replace(/\s+/g, " ");
			const nameKey = nameKeyOf(name);
			const existing = await context.db
				.select({ id: rsvp.id })
				.from(rsvp)
				.where(and(eq(rsvp.weekOf, weekOf), eq(rsvp.nameKey, nameKey)))
				.get();
			if (existing) {
				await context.db
					.update(rsvp)
					.set({ isIn: true })
					.where(eq(rsvp.id, existing.id));
			} else {
				await context.db.insert(rsvp).values({
					id: crypto.randomUUID(),
					weekOf,
					name,
					nameKey,
					isIn: true,
					userId: context.session?.user.id ?? null,
				});
			}
			return listWeek(context.db, weekOf);
		}),

	/** Flip a name between In and Out. */
	toggle: publicProcedure
		.input(z.object({ id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const weekOf = currentWeekOf();
			const row = await context.db
				.select({ id: rsvp.id, isIn: rsvp.isIn })
				.from(rsvp)
				.where(and(eq(rsvp.id, input.id), eq(rsvp.weekOf, weekOf)))
				.get();
			if (!row) {
				throw new ORPCError("NOT_FOUND", {
					message: "That name is not on this week's sheet.",
				});
			}
			await context.db
				.update(rsvp)
				.set({ isIn: !row.isIn })
				.where(eq(rsvp.id, row.id));
			return listWeek(context.db, weekOf);
		}),
};
