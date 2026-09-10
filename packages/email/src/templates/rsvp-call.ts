import type { Rendered } from "../brevo";
import { baseFacts, type RsvpFacts, render } from "./rsvp";

export type RsvpCallInput = RsvpFacts & {
	/** The game is today, not tomorrow -- a gym booked late. */
	today: boolean;
	/** Ten already said yes before we even asked. It happens. */
	alreadyOn: boolean;
};

/** Stage 01. The evening before: there is a gym, say something. */
export function rsvpCallEmail(input: RsvpCallInput): Rendered {
	const day = input.today ? "tonight" : "tomorrow";
	const heading = input.alreadyOn
		? `${input.confirmAt} already. The run is on.`
		: `There is a gym ${day}.`;

	return render({
		subject: input.alreadyOn
			? `${input.dateLabel}: the run is on. Say if you're in.`
			: `${input.today ? "Tonight" : "Tomorrow"}, ${input.timeLabel}. In, out, or maybe.`,
		title: heading,
		kicker: input.today ? "Tonight" : "Tomorrow",
		heading,
		lead: input.alreadyOn
			? `${input.confirmAt} of you got there before the email did. It is happening. Say where you stand anyway, so the count means something.`
			: `${input.confirmAt} answers make it a run. ${input.playAt} make it a bad run that still counts. Answer now, not at 8:55 from the driveway.`,
		facts: baseFacts(input),
		notes: input.notes,
		answers: ["in", "maybe", "out"],
		tail: "Maybe means maybe. It does not count toward ten, and everybody knows it.",
		facts_: input,
	});
}
