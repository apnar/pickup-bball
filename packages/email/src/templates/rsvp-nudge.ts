import type { Rendered } from "../brevo";
import { baseFacts, type RsvpFacts, render } from "./rsvp";

export type RsvpNudgeInput = RsvpFacts & { needed: number };

/** Stage 02. Game day, still short, and you have said nothing. */
export function rsvpNudgeEmail(input: RsvpNudgeInput): Rendered {
	const needed = `${input.needed} more`;
	return render({
		subject: `${input.inCount} in, ${input.needed} short. You have not said anything.`,
		title: "You have not answered.",
		kicker: "Tonight",
		heading: "You have not answered.",
		lead: `${input.inCount} guys committed to tonight. You are not one of them. ${needed} and it is a run; otherwise it is Sean, a ball, and a permit he already paid for.`,
		facts: [...baseFacts(input), { label: "Need", value: needed }],
		notes: input.notes,
		answers: ["in", "maybe", "out"],
		tail: "This one only went to the guys who have not answered. It is a short list and you are on it.",
		facts_: input,
	});
}
