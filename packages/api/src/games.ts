import { game } from "@pickup-bball/db/schema/game";
import { permit } from "@pickup-bball/db/schema/permit";
import { rsvp } from "@pickup-bball/db/schema/rsvp";
import { asc, desc, eq, gte, lt, sql } from "drizzle-orm";

import type { Context } from "./context";
import { formatGameDate, formatGameTime, todayInRunTimezone } from "./run";

type Db = Context["db"];

/** Base query: games with their permit summary and current In count. */
function selectGames(db: Db) {
	return db
		.select({
			id: game.id,
			date: game.date,
			startTime: game.startTime,
			endTime: game.endTime,
			location: game.location,
			notes: game.notes,
			announcedAt: game.announcedAt,
			reminderSentAt: game.reminderSentAt,
			permit: {
				id: permit.id,
				label: permit.label,
				fileName: permit.fileName,
			},
			inCount: sql<number>`(select count(*) from ${rsvp} where ${rsvp.gameId} = ${game.id} and ${rsvp.isIn} = 1)`,
		})
		.from(game)
		.leftJoin(permit, eq(game.permitId, permit.id));
}

type GameRow = Awaited<
	ReturnType<ReturnType<typeof selectGames>["all"]>
>[number];

export function decorateGame(row: GameRow) {
	return {
		...row,
		permit: row.permit?.id ? row.permit : null,
		dateLabel: formatGameDate(row.date),
		timeLabel: row.endTime
			? `${formatGameTime(row.startTime)} - ${formatGameTime(row.endTime)}`
			: formatGameTime(row.startTime),
		isPast: row.date < todayInRunTimezone(),
	};
}

export type GameSummary = ReturnType<typeof decorateGame>;

export async function findNextGame(db: Db) {
	const row = await selectGames(db)
		.where(gte(game.date, todayInRunTimezone()))
		.orderBy(asc(game.date), asc(game.startTime))
		.get();
	return row ? decorateGame(row) : null;
}

export async function findGame(db: Db, id: string) {
	const row = await selectGames(db).where(eq(game.id, id)).get();
	return row ? decorateGame(row) : null;
}

export async function listGames(db: Db, pastLimit = 5) {
	const today = todayInRunTimezone();
	const upcoming = await selectGames(db)
		.where(gte(game.date, today))
		.orderBy(asc(game.date), asc(game.startTime))
		.all();
	const past = await selectGames(db)
		.where(lt(game.date, today))
		.orderBy(desc(game.date), desc(game.startTime))
		.limit(pastLimit)
		.all();
	return {
		upcoming: upcoming.map(decorateGame),
		past: past.map(decorateGame),
	};
}
