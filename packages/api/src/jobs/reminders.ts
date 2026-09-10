import { game } from "@pickup-bball/db/schema/game";
import { and, asc, eq, gt, isNull } from "drizzle-orm";

import type { Context } from "../context";
import { findGame } from "../games";
import { renderReminder, sendToList } from "../mail";
import { timeInRunTimezone, todayInRunTimezone } from "../run";

type Db = Context["db"];

/** Reminders go out once the gym's clock reaches this hour on game day. */
export const REMINDER_LOCAL_HOUR = 9;

export type ReminderRunResult = {
	skipped?: string;
	sent: { gameId: string; recipients: number; failed: number }[];
};

/**
 * Claim the game, then send. The conditional update is the once-only lock:
 * two overlapping runs cannot both see `changes === 1`.
 */
async function claim(db: Db, gameId: string, now: Date): Promise<boolean> {
	const result = await db
		.update(game)
		.set({ reminderSentAt: now })
		.where(and(eq(game.id, gameId), isNull(game.reminderSentAt)))
		.run();
	return result.meta.changes === 1;
}

async function release(db: Db, gameId: string) {
	await db
		.update(game)
		.set({ reminderSentAt: null })
		.where(eq(game.id, gameId));
}

/**
 * Called hourly by the Cron Trigger (and by the admin "send reminder now"
 * button through `sendReminderFor`). Sends the game-day reminder for every
 * game today whose tip-off is still ahead and that has not been reminded.
 */
export async function sendDueReminders(
	db: Db,
	now: Date = new Date(),
): Promise<ReminderRunResult> {
	const localTime = timeInRunTimezone(now);
	const hour = Number(localTime.slice(0, 2));
	if (hour < REMINDER_LOCAL_HOUR) {
		return { skipped: `It is ${localTime} at the gym; too early.`, sent: [] };
	}
	const due = await db
		.select({ id: game.id })
		.from(game)
		.where(
			and(
				eq(game.date, todayInRunTimezone(now)),
				isNull(game.reminderSentAt),
				gt(game.startTime, localTime),
			),
		)
		.orderBy(asc(game.startTime))
		.all();
	if (due.length === 0)
		return { skipped: "No game needs a reminder.", sent: [] };

	const sent: ReminderRunResult["sent"] = [];
	for (const row of due) {
		const outcome = await sendReminderFor(db, row.id, now);
		if (outcome) sent.push(outcome);
	}
	return { sent };
}

/** Send the reminder for one game if it has not gone out yet. */
export async function sendReminderFor(
	db: Db,
	gameId: string,
	now: Date = new Date(),
): Promise<{ gameId: string; recipients: number; failed: number } | null> {
	const summary = await findGame(db, gameId);
	if (!summary) return null;
	if (!(await claim(db, gameId, now))) return null;
	try {
		const rendered = await renderReminder(db, summary);
		const result = await sendToList(db, {
			kind: "reminder",
			gameId,
			rendered,
			// Active only, always. Somebody nursing a calf does not need a 9 AM
			// headcount for a game they already said they are missing.
			audience: "active",
		});
		if (!result) {
			// Nobody on the list: leave the lock so we do not retry hourly.
			return { gameId, recipients: 0, failed: 0 };
		}
		if (result.sent === 0) {
			await release(db, gameId);
		}
		return {
			gameId,
			recipients: result.attempted,
			failed: result.attempted - result.sent,
		};
	} catch (error) {
		await release(db, gameId);
		throw error;
	}
}
