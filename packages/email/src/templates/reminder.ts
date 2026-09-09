import type { Rendered } from "../brevo";
import { emailLink } from "../links";
import {
	button,
	factsTable,
	layout,
	listFooter,
	listFooterText,
	muted,
} from "../render";

export type ReminderInput = {
	dateLabel: string;
	timeLabel: string;
	location: string;
	inCount: number;
	capacity: number;
	inNames: string[];
	siteUrl: string;
};

function headline(inCount: number, open: number): string {
	if (open <= 0) return "Run is full. Someone is sitting.";
	if (inCount >= 8) return "We have a game. Barely.";
	if (inCount >= 5) return "Half court unless three more grow up.";
	return "This is a shooting session, not a run.";
}

/** Game-day nudge with the current headcount. Sent by the cron, once per game. */
export function reminderEmail(input: ReminderInput): Rendered {
	const rsvpUrl = emailLink(input.siteUrl, "/#rsvp");
	const open = Math.max(0, input.capacity - input.inCount);
	const spots = `${open} spot${open === 1 ? "" : "s"} left`;
	const names =
		input.inNames.length > 0 ? input.inNames.join(", ") : "Nobody. Yet.";

	const html = layout({
		title: `Tonight: ${input.dateLabel}`,
		kicker: "Tonight",
		heading: headline(input.inCount, open),
		bodyHtml: [
			`<p style="margin:0 0 14px; font-size:16px; line-height:1.5;">${input.inCount} in, ${spots}. Flipping to Out today is public record.</p>`,
			factsTable([
				{ label: "When", value: `${input.dateLabel}, ${input.timeLabel}` },
				{ label: "Where", value: input.location },
				{ label: "In", value: names },
			]),
			button("Fix my status", rsvpUrl),
			muted(
				"Layup lines start when Dev arrives. Layup lines are therefore theoretical.",
			),
		].join("\n"),
		footerHtml: listFooter(),
	});

	const text = [
		`Tonight: ${input.dateLabel}, ${input.timeLabel} at ${input.location}`,
		"",
		headline(input.inCount, open),
		`${input.inCount} in, ${spots}. Flipping to Out today is public record.`,
		"",
		`In: ${names}`,
		"",
		`Fix your status: ${rsvpUrl}`,
		"",
		listFooterText(),
	].join("\n");

	return {
		subject: `Tonight: ${input.inCount} in, ${spots}`,
		html,
		text,
	};
}
