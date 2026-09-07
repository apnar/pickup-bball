import { ORPCError } from "@orpc/server";
import { game } from "@pickup-bball/db/schema/game";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { findGame, findNextGame, listGames } from "../games";
import { adminProcedure, publicProcedure } from "../index";

/** D1 wraps SQLite errors twice; the UNIQUE text lives in a nested cause. */
function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && current; depth++) {
		const message =
			current instanceof Error ? current.message : String(current);
		if (message.includes("UNIQUE constraint failed")) return true;
		current = current instanceof Error ? current.cause : undefined;
	}
	return false;
}

const dateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.");
const timeSchema = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM.");

const gameInput = z.object({
	date: dateSchema,
	startTime: timeSchema,
	endTime: timeSchema.nullable().optional(),
	location: z.string().trim().min(1, "Where?").max(80),
	notes: z.string().trim().max(300).nullable().optional(),
	permitId: z.string().min(1).nullable().optional(),
});

export const gamesRouter = {
	/** The next game on or after today, or null when no gym is booked. */
	next: publicProcedure.handler(({ context }) => findNextGame(context.db)),

	/** Upcoming games plus a few recent ones, for the schedule page. */
	list: publicProcedure.handler(({ context }) => listGames(context.db)),

	create: adminProcedure
		.input(gameInput)
		.handler(async ({ context, input }) => {
			const id = crypto.randomUUID();
			try {
				await context.db.insert(game).values({
					id,
					date: input.date,
					startTime: input.startTime,
					endTime: input.endTime ?? null,
					location: input.location,
					notes: input.notes || null,
					permitId: input.permitId ?? null,
					createdBy: context.session.user.id,
				});
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ORPCError("CONFLICT", {
						message: "There is already a game at that date and time.",
					});
				}
				throw error;
			}
			return findGame(context.db, id);
		}),

	update: adminProcedure
		.input(gameInput.partial().extend({ id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const { id, ...changes } = input;
			const existing = await findGame(context.db, id);
			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "No such game." });
			}
			await context.db
				.update(game)
				.set({
					...(changes.date !== undefined && { date: changes.date }),
					...(changes.startTime !== undefined && {
						startTime: changes.startTime,
					}),
					...(changes.endTime !== undefined && {
						endTime: changes.endTime ?? null,
					}),
					...(changes.location !== undefined && {
						location: changes.location,
					}),
					...(changes.notes !== undefined && { notes: changes.notes || null }),
					...(changes.permitId !== undefined && {
						permitId: changes.permitId ?? null,
					}),
				})
				.where(eq(game.id, id));
			return findGame(context.db, id);
		}),

	remove: adminProcedure
		.input(z.object({ id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await context.db.delete(game).where(eq(game.id, input.id));
			return { ok: true };
		}),
};
