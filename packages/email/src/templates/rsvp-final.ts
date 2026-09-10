import type { Rendered } from "../brevo";
import { emailLink } from "../links";
import {
	button,
	escapeHtml,
	factsTable,
	layout,
	listFooter,
	listFooterText,
	muted,
} from "../render";
import { baseFacts, nameList, para, type RsvpFacts } from "./rsvp";

export type RsvpFinalInput = RsvpFacts & {
	decision: "on" | "off";
	permitUrl: string | null;
};

/**
 * Stage 05. Half past seven, the count is what it is.
 *
 * The only email in the cycle with no answer buttons: the question is closed.
 * When the answer is "off" it also goes wider than the rest -- to the people
 * who never answered, and to whoever typed in a guest -- because the guy who
 * ignored five emails is exactly the guy who drives to a locked gym out of
 * habit, and a guest has no inbox at all.
 */
export function rsvpFinalEmail(input: RsvpFinalInput): Rendered {
	const on = input.decision === "on";
	const heading = on ? "It is happening." : "Not tonight.";
	const kicker = on ? "Confirmed" : "Called off";
	const lead = on
		? `${input.inCount} in. ${input.inCount >= input.confirmAt ? "That is a run." : `${input.confirmAt} would have been nicer, but ${input.playAt} is the number and we cleared it.`} Bring water and a jump shot.`
		: `${input.inCount}. That is a shooting session with a scoreboard. The gym stays empty, Sean paid for it anyway, and you can think about that on Wednesday.`;

	const facts = baseFacts(input);
	if (!on && input.maybeNames.length > 0) {
		facts.push({ label: "Maybe", value: nameList(input.maybeNames) });
	}

	const sponsorNote = muted(
		escapeHtml(
			on
				? "Put somebody down who is not on the list? They are expecting you to tell them. Tell them."
				: "Put somebody down who is not on the list? They do not get these. Go tell them before they drive over.",
		),
	);

	const html = layout({
		title: on ? `Run is on: ${input.dateLabel}` : `No run: ${input.dateLabel}`,
		kicker,
		heading,
		bodyHtml: [
			para(lead),
			factsTable(facts),
			input.notes && on ? para(input.notes) : "",
			on && input.permitUrl
				? muted(
						`Gym staff want proof? The permit is at <a href="${escapeHtml(input.permitUrl)}" style="color:#2f5f86;">${escapeHtml(input.permitUrl)}</a>.`,
					)
				: "",
			button(
				on ? "See who is in" : "The schedule",
				emailLink(input.siteUrl, on ? "/#rsvp" : "/schedule"),
			),
			sponsorNote,
		]
			.filter(Boolean)
			.join("\n"),
		footerHtml: listFooter(),
	});

	const text = [
		heading,
		"",
		lead,
		"",
		...facts.map((f) => `${f.label}: ${f.value}`),
		...(input.notes && on ? ["", input.notes] : []),
		...(on && input.permitUrl ? ["", `Permit: ${input.permitUrl}`] : []),
		"",
		emailLink(input.siteUrl, on ? "/#rsvp" : "/schedule"),
		"",
		on
			? "Put somebody down who is not on the list? They are expecting you to tell them. Tell them."
			: "Put somebody down who is not on the list? They do not get these. Go tell them before they drive over.",
		"",
		listFooterText(),
	].join("\n");

	return {
		subject: on
			? `Run is on. ${input.inCount} in.`
			: `No run tonight. ${input.inCount} in.`,
		html,
		text,
	};
}
