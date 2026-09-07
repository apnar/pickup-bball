import { ORPCError } from "@orpc/server";
import { rsvp } from "@pickup-bball/db/schema/rsvp";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { findGame, findNextGame, type GameSummary } from "../games";
import { publicProcedure } from "../index";
import { CAPACITY, nameKeyOf } from "../run";

const nameSchema = z
	.string()
	.trim()
	.min(1, "Put a name in.")
	.max(40, "That is not a name, that is a paragraph.");

async function listGame(db: Context["db"], game: GameSummary) {
	const rows = await db
		.select({ id: rsvp.id, name: rsvp.name, isIn: rsvp.isIn })
		.from(rsvp)
		.where(eq(rsvp.gameId, game.id))
		.orderBy(asc(rsvp.createdAt));
	return {
		game,
		capacity: CAPACITY,
		rsvps: rows,
	};
}

export type Headcount = Awaited<ReturnType<typeof listGame>>;

async function requireGame(db: Context["db"], id: string) {
	const game = await findGame(db, id);
	if (!game) {
		throw new ORPCError("NOT_FOUND", {
			message: "That game is not on the schedule.",
		});
	}
	return game;
}

export const rsvpRouter = {
	/** Headcount for a game; defaults to the next game. Null when nothing is booked. */
	list: publicProcedure
		.input(z.object({ gameId: z.string().min(1).optional() }))
		.handler(async ({ context, input }) => {
			const game = input.gameId
				? await findGame(context.db, input.gameId)
				: await findNextGame(context.db);
			return game ? listGame(context.db, game) : null;
		}),

	/** Put a name in for a game. An existing name is flipped back to In. */
	add: publicProcedure
		.input(z.object({ gameId: z.string().min(1), name: nameSchema }))
		.handler(async ({ context, input }) => {
			const game = await requireGame(context.db, input.gameId);
			const name = input.name.replace(/\s+/g, " ");
			const nameKey = nameKeyOf(name);
			const existing = await context.db
				.select({ id: rsvp.id })
				.from(rsvp)
				.where(and(eq(rsvp.gameId, game.id), eq(rsvp.nameKey, nameKey)))
				.get();
			if (existing) {
				await context.db
					.update(rsvp)
					.set({ isIn: true })
					.where(eq(rsvp.id, existing.id));
			} else {
				await context.db.insert(rsvp).values({
					id: crypto.randomUUID(),
					gameId: game.id,
					name,
					nameKey,
					isIn: true,
					userId: context.session?.user.id ?? null,
				});
			}
			return listGame(
				context.db,
				(await findGame(context.db, game.id)) ?? game,
			);
		}),

	/** Flip a name between In and Out. */
	toggle: publicProcedure
		.input(z.object({ gameId: z.string().min(1), id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const game = await requireGame(context.db, input.gameId);
			const row = await context.db
				.select({ id: rsvp.id, isIn: rsvp.isIn })
				.from(rsvp)
				.where(and(eq(rsvp.id, input.id), eq(rsvp.gameId, game.id)))
				.get();
			if (!row) {
				throw new ORPCError("NOT_FOUND", {
					message: "That name is not on this game's sheet.",
				});
			}
			await context.db
				.update(rsvp)
				.set({ isIn: !row.isIn })
				.where(eq(rsvp.id, row.id));
			return listGame(
				context.db,
				(await findGame(context.db, game.id)) ?? game,
			);
		}),
};
