/**
 * The copy that describes where an RSVP drive stands. One place, because it
 * is read on the board, on the confirm page a cycle email lands on, and in
 * the emails themselves -- and three copies of a joke drift into three
 * different jokes.
 */

import type { Headcount } from "@pickup-bball/api/routers/rsvp";

export type RsvpAnswer = "in" | "maybe" | "out";

export const ANSWERS: readonly RsvpAnswer[] = ["in", "maybe", "out"];

export type Counts = Headcount["counts"];

/** The one line at the top. First match wins. */
export function headline(
	counts: Counts,
	limits: { confirmAt: number; playAt: number; capacity: number },
	status: "scheduled" | "confirmed" | "canceled",
	decided: boolean,
): string {
	if (status === "canceled") {
		return "Called off. Go lie about your back somewhere else.";
	}
	if (status === "confirmed") {
		return decided ? "Game on. Nine sharp." : "We have a game. Ten said yes.";
	}
	if (counts.in >= limits.capacity) return "Sheet is full. Someone is sitting.";
	if (counts.in >= limits.confirmAt) return "We have a game. Barely.";
	if (counts.in >= limits.playAt) return "Enough to play. Not enough to relax.";
	if (counts.in >= 5) return "Half court unless three more grow up.";
	return "Not a run yet. Right now it's a carpool.";
}

/**
 * The next threshold, in words, always with a number in it.
 *
 * The sheet holds more than the number that confirms a run, so "five spots
 * left" and "three more to go" are both true at once and together they are
 * gibberish. Lead with the number that decides whether there is a run at all,
 * and only mention spots once there is one.
 */
export function subline(
	counts: Counts,
	limits: { confirmAt: number; playAt: number; capacity: number },
	status: "scheduled" | "confirmed" | "canceled",
): string {
	const plural = (n: number, one: string, many: string) =>
		n === 1 ? one : many;

	if (status === "canceled") {
		return `${counts.in} in at the final call. ${limits.playAt} was the number. Next Monday, then.`;
	}
	if (status === "confirmed") {
		const spare = counts.in - limits.playAt + 1;
		if (counts.in >= limits.capacity) {
			return "First to the gym plays. Last to the gym referees, badly.";
		}
		return `It stays on unless ${spare} of you ${plural(spare, "gets", "get")} cute before 7:30.`;
	}
	if (counts.in >= limits.playAt) {
		const need = limits.confirmAt - counts.in;
		const maybes = counts.maybe
			? ` ${counts.maybe} ${plural(counts.maybe, "maybe does", "maybes do")} not count; a maybe is a mailing list.`
			: "";
		return `${need} more ${plural(need, "yes", "yeses")} and it locks.${maybes}`;
	}
	const short = limits.playAt - counts.in;
	const quiet = counts.silent
		? ` ${counts.silent} ${plural(counts.silent, "person has", "people have")} not said a word.`
		: " Everybody answered. Put it in the trophy case.";
	return `${short} short of the minimum.${quiet}`;
}

/** What the viewer's own answer means for them, under the picker. */
export function yourLine(answer: RsvpAnswer | null, locked: boolean): string {
	if (locked) return "Called at 7:31. Nothing you tap now changes it.";
	switch (answer) {
		case "in":
			return "In. Changing this after 6 PM is public record.";
		case "maybe":
			return "Maybe does not count toward ten. It keeps you on the emails, and that is the whole job.";
		case "out":
			return "Out. Noted, filed, read aloud.";
		default:
			return "Nothing from you yet. The list notices.";
	}
}

/**
 * Whether the run is actually asking for a guest, and the line that says so.
 *
 * Guests are a remedy for being short, not a feature. The list gets first
 * refusal all day; only once the six o'clock call has gone out and we are
 * still under ten does bringing a body become the helpful thing to do. So the
 * box stays shut until then and explains itself, rather than sitting open and
 * quietly suggesting that every Monday needs a ringer.
 */
export function guestGate(
	counts: Counts,
	limits: { confirmAt: number; playAt: number; capacity: number },
	lastCallPassed: boolean,
	locked: boolean,
): { open: boolean; line: string } {
	if (locked) {
		return {
			open: false,
			line: "The count is closed. Whoever you were bringing, tell them yourself.",
		};
	}
	if (counts.in >= limits.confirmAt) {
		return {
			open: false,
			line: `${counts.in} in. The list handled it, so nobody needs to go find a ringer.`,
		};
	}
	if (!lastCallPassed) {
		return {
			open: false,
			line: "The list gets first crack. If we are still under ten when the six o'clock call goes out, this opens and you can go find a body.",
		};
	}
	const short = limits.confirmAt - counts.in;
	return {
		open: true,
		line: `Six has come and gone and we are ${short} short. Now is the night to know somebody.`,
	};
}
