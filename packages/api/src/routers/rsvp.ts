import { ORPCError } from "@orpc/server";
import { effectiveStatus, findPersonState } from "@pickup-bball/db/people";
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
	// Asked of D1, not of `session.user`: the session cookie caches the user
	// for five minutes, and a stale copy here would leave somebody who just
	// stepped away still able to take a spot.
	const state = userId ? await findPersonState(db, userId) : null;
	return {
		game,
		capacity: CAPACITY,
		/** The caller's own row, so the board can mark it "you". */
		me: (userId && rows.find((r) => r.userId === userId)?.id) || null,
		/** The caller's own state, so the board knows which button to show. */
		viewer: state
			? {
					status: effectiveStatus(state),
					suspendedUntil: state.suspendedUntil,
					reason: state.statusReason,
				}
			: null,
		rsvps: rows.map(({ userId: _userId, ...r }) => r),
	};
}

/**
 * The caller's real status. Asked of D1 rather than of the session, which
 * matters twice over: the session cookie caches the user for five minutes,
 * so a stale copy would let somebody who just stepped away take a spot, and
 * it is also the only thing standing between a just-deactivated player and
 * the sheet until that cache expires and signs them out.
 */
async function statusOf(db: Context["db"], userId: string) {
	const state = await findPersonState(db, userId);
	return state ? effectiveStatus(state) : "active";
}

/** Anybody deactivated is simply not here, cached session or not. */
async function requireHere(db: Context["db"], userId: string) {
	if ((await statusOf(db, userId)) === "deactivated") {
		throw new ORPCError("FORBIDDEN", {
			message: "That account is deactivated.",
		});
	}
}

/**
 * Taking one of twelve spots needs more than being here. Somebody on a break
 * does not hold one -- though they can still put a friend on the sheet and
 * still flip a name back to Out, which is why this is not the same check.
 */
async function requireSpot(db: Context["db"], userId: string) {
	const status = await statusOf(db, userId);
	if (status === "deactivated") {
		throw new ORPCError("FORBIDDEN", {
			message: "That account is deactivated.",
		});
	}
	if (status === "suspended") {
		throw new ORPCError("BAD_REQUEST", {
			message: "You're taking a break. Say you're back first.",
		});
	}
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
			await requireSpot(context.db, context.session.user.id);
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
			await requireHere(context.db, context.session.user.id);
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
