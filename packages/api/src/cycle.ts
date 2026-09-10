/**
 * The RSVP cycle: what the run asks the list, when, and what it does with the
 * answers. This is the only place those facts exist. The job runs off it, the
 * admin write-up page renders it, and the numbers below are interpolated into
 * both -- so the page cannot describe a schedule the code is not keeping.
 *
 * Pure by design: nothing here may import drizzle, the Worker env, or anything
 * that reaches them, because the web app pulls this into the client bundle.
 */

import type { EmailKind } from "@pickup-bball/db/schema/email";

import { CAPACITY } from "./run";

/** Ten answers make it a run, and the tenth turns the lights on early. */
export const CONFIRM_AT = 10;

/** Eight makes it a bad run that still counts. Seven is a shooting session. */
export const PLAY_AT = 8;

/**
 * No two cycle emails about the same game land closer than this. A game
 * booked at four on a Monday would otherwise fire four stages in one minute,
 * one of which accuses the reader of ignoring a message they never got.
 */
export const STAGE_COOLDOWN_MINUTES = 90;

export type StageKey = "call" | "nudge" | "confirmed" | "lastCall" | "final";

/** The `game` column that records a stage as resolved. */
export type StageColumn =
	| "callAt"
	| "nudgeAt"
	| "confirmedAt"
	| "lastCallAt"
	| "decidedAt";

export type Stage = {
	key: StageKey;
	/** "01".."05", for the write-up. */
	num: string;
	column: StageColumn;
	kind: EmailKind;
	/** Days from the game's date. -1 is the evening before. */
	dayOffset: number;
	/** HH:MM on the gym's clock, or null when a count fires it, not the clock. */
	at: string | null;
	/* The write-up, rendered by /admin/cycle. Nobody types these twice. */
	when: string;
	who: string;
	title: string;
	says: string;
	aside: string;
};

export const STAGES: readonly Stage[] = [
	{
		key: "call",
		num: "01",
		column: "callAt",
		kind: "rsvp_call",
		dayOffset: -1,
		at: "17:00",
		when: "5:00 PM, the day before",
		who: "Everybody on the list",
		title: "The ask",
		says: "There is a run tomorrow, here is the gym, and here are three buttons: in, out, maybe.",
		aside:
			"Three buttons, because two was never enough hedging for this group.",
	},
	{
		key: "nudge",
		num: "02",
		column: "nudgeAt",
		kind: "rsvp_nudge",
		dayOffset: 0,
		at: "14:00",
		when: "2:00 PM on game day",
		who: "Only the people who have not answered",
		title: "The prod",
		says: `Sent only if fewer than ${CONFIRM_AT} are in. Carries the names of everyone who already said yes. Anybody who has answered is left alone.`,
		aside: "Silence is not an answer. It is a slower one.",
	},
	{
		key: "confirmed",
		num: "03",
		column: "confirmedAt",
		kind: "rsvp_confirmed",
		dayOffset: 0,
		at: null,
		when: `the moment the ${CONFIRM_AT}th yes lands`,
		who: "Everyone who said in or maybe",
		title: "Game on",
		says: `The ${CONFIRM_AT}th yes turns the lights on, whatever time it arrives. Fires once and never un-fires.`,
		aside: `${CONFIRM_AT} is enough for fives with two guys arguing on the sideline, which is the format.`,
	},
	{
		key: "lastCall",
		num: "04",
		column: "lastCallAt",
		kind: "rsvp_last_call",
		dayOffset: 0,
		at: "18:00",
		when: "6:00 PM on game day",
		who: "The maybes, and the ones who still have not answered",
		title: "Last call",
		says: `Sent only if we are still short of ${CONFIRM_AT}. This is the email that exists to turn a maybe into a number.`,
		aside: "The maybes get one more chance to become a person with an opinion.",
	},
	{
		key: "final",
		num: "05",
		column: "decidedAt",
		kind: "rsvp_final",
		dayOffset: 0,
		at: "19:30",
		when: "7:30 PM on game day",
		who: "Everyone who answered. If it is off, everybody else too.",
		title: "The verdict",
		says: `${PLAY_AT} or more in and the run is on. Fewer and it is off. If it was already on and still is, nothing is sent -- the answer has not changed.`,
		aside: "Ninety minutes before tip-off is enough time to find a couch.",
	},
];

/** The stages a clock fires. Stage 03 is fired by a count, so it is not here. */
export const CLOCK_STAGES: readonly Stage[] = STAGES.filter(
	(s) => s.at !== null,
);

export const STAGE = Object.fromEntries(
	STAGES.map((s) => [s.key, s]),
) as Record<StageKey, Stage>;

/** The numbers, for the write-up. Same constants the job counts with. */
export const CYCLE_NUMBERS = [
	{
		value: CONFIRM_AT,
		label: "Confirm",
		body: "The tenth yes turns the lights on early and stops the nagging.",
	},
	{
		value: PLAY_AT,
		label: "Minimum",
		body: "Four on four with one guy rebounding for both teams. Below that we are not doing it.",
	},
	{
		value: CAPACITY,
		label: "Capacity",
		body: "Twelve is the good number. Fifteen is the one where somebody sits a whole game and is loud about it. Past that it is a waiting list with feelings.",
	},
] as const;
