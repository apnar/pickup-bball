import { ORPCError } from "@orpc/server";
import { rsvp } from "@pickup-bball/db/schema/rsvp";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { findGame, findNextGame, type GameSummary } from "../games";
import { protectedProcedure } from "../index";
import { CAPACITY, nameKeyOf } from "../run";

const nameSchema = z
	.string()
	.trim()
	.min(1, "Put a name in.")
	.max(40, "That is not a name, that is a paragraph.");

async function listGame(
	db: Context["db"],
	game: GameSummary,
	userId: string | null,
) {
	const rows = await db
		.select({
			id: rsvp.id,
			name: rsvp.name,
			isIn: rsvp.isIn,
			userId: rsvp.userId,
		})
		.from(rsvp)
		.where(eq(rsvp.gameId, game.id))
		.orderBy(asc(rsvp.createdAt));
	return {
		game,
		capacity: CAPACITY,
		/** The caller's own row, so the board can mark it "you". */
		me: (userId && rows.find((r) => r.userId === userId)?.id) || null,
		rsvps: rows.map(({ userId: _userId, ...r }) => r),
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

/** Put one name on a game's sheet, or flip an existing one back to In. */
async function putName(
	db: Context["db"],
	game: GameSummary,
	input: { name: string; userId: string | null },
) {
	const name = input.name.replace(/\s+/g, " ");
	const nameKey = nameKeyOf(name);
	const existing = await db
		.select({ id: rsvp.id, userId: rsvp.userId })
		.from(rsvp)
		.where(and(eq(rsvp.gameId, game.id), eq(rsvp.nameKey, nameKey)))
		.get();
	if (existing) {
		await db
			.update(rsvp)
			.set({
				isIn: true,
				// Claim a name a friend typed in for you earlier.
				...(existing.userId === null &&
					input.userId && { userId: input.userId }),
			})
			.where(eq(rsvp.id, existing.id));
		return;
	}
	await db.insert(rsvp).values({
		id: crypto.randomUUID(),
		gameId: game.id,
		name,
		nameKey,
		isIn: true,
		userId: input.userId,
	});
}

export const rsvpRouter = {
	/** Headcount for a game; defaults to the next game. Null when nothing is booked. */
	list: protectedProcedure
		.input(z.object({ gameId: z.string().min(1).optional() }))
		.handler(async ({ context, input }) => {
			const game = input.gameId
				? await findGame(context.db, input.gameId)
				: await findNextGame(context.db);
			return game ? listGame(context.db, game, context.session.user.id) : null;
		}),

	/** One tap: put yourself in under your own name. */
	addMe: protectedProcedure
		.input(z.object({ gameId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const game = await requireGame(context.db, input.gameId);
			await putName(context.db, game, {
				name: context.session.user.name,
				userId: context.session.user.id,
			});
			return listGame(
				context.db,
				(await findGame(context.db, game.id)) ?? game,
				context.session.user.id,
			);
		}),

	/** Put someone else's name in. An existing name is flipped back to In. */
	add: protectedProcedure
		.input(z.object({ gameId: z.string().min(1), name: nameSchema }))
		.handler(async ({ context, input }) => {
			const game = await requireGame(context.db, input.gameId);
			await putName(context.db, game, { name: input.name, userId: null });
			return listGame(
				context.db,
				(await findGame(context.db, game.id)) ?? game,
				context.session.user.id,
			);
		}),

	/** Flip a name between In and Out. */
	toggle: protectedProcedure
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
				context.session.user.id,
			);
		}),
};
