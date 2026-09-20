import type { Rendered } from "../brevo";
import { type ContributionFacts, render } from "./contribution";

export type ContributionCallInput = ContributionFacts & {
	subject: string;
	body: string;
};

const TAIL =
	"You are getting this because you are on the list. Everybody on it got the same one.";

/** The ask, sent to everybody who is playing. */
export function contributionCallEmail(input: ContributionCallInput): Rendered {
	return render({
		...input,
		heading: input.subject,
		tail: TAIL,
	});
}

/**
 * What an admin sees in the box before they touch it. Standing copy, not a
 * template: it is prefilled and editable, so a call that wants different
 * words gets them. The amount is deliberately absent from the prose -- the
 * facts table carries the number, and one place for it means the two cannot
 * disagree after an edit.
 */
export function contributionCallDefaults(_amount: number): {
	subject: string;
	body: string;
} {
	return {
		subject: "Gym money.",
		body: [
			"Sean has paid the county for the gym. Now the gym pays Sean back, which is you.",
			"Everybody on the list owes the same amount. Whether you made every Monday or two of them is between you and your hamstring. The court was rented either way.",
			"How to get it to him is below. Once it lands he marks you paid and you hear no more about it.",
		].join("\n\n"),
	};
}
