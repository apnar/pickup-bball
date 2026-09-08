import type { Rendered } from "../brevo";
import {
	button,
	escapeHtml,
	factsTable,
	layout,
	listFooter,
	listFooterText,
	muted,
} from "../render";

export type AnnouncementInput = {
	dateLabel: string;
	timeLabel: string;
	location: string;
	notes: string | null;
	permitUrl: string | null;
	siteUrl: string;
	inCount: number;
	capacity: number;
};

/** "We have a gym." Sent by an admin once a game is booked. */
export function announcementEmail(input: AnnouncementInput): Rendered {
	const rsvpUrl = `${input.siteUrl}/#rsvp`;
	const open = Math.max(0, input.capacity - input.inCount);
	const facts = [
		{ label: "When", value: `${input.dateLabel}, ${input.timeLabel}` },
		{ label: "Where", value: input.location },
		{ label: "Spots", value: `${open} of ${input.capacity} open` },
	];
	const notesHtml = input.notes
		? `<p style="margin:0 0 14px; font-size:16px; line-height:1.5;">${escapeHtml(input.notes)}</p>`
		: "";
	const permitHtml = input.permitUrl
		? muted(
				`Gym staff want proof? The permit is at <a href="${escapeHtml(input.permitUrl)}" style="color:#2f5f86;">${escapeHtml(input.permitUrl)}</a>.`,
			)
		: "";

	const html = layout({
		title: `Gym booked: ${input.dateLabel}`,
		kicker: "Gym booked",
		heading: `${input.dateLabel}. ${input.timeLabel}.`,
		bodyHtml: [
			`<p style="margin:0 0 14px; font-size:16px; line-height:1.5;">A permit exists. Put your name in before the guys who "might come" do.</p>`,
			factsTable(facts),
			notesHtml,
			button("Put my name in", rsvpUrl),
			permitHtml,
			muted("Two shirts. Water. Show up."),
		].join("\n"),
		footerHtml: listFooter(),
	});

	const text = [
		`Gym booked: ${input.dateLabel}, ${input.timeLabel}`,
		"",
		`A permit exists. Put your name in before the guys who "might come" do.`,
		"",
		`When:  ${input.dateLabel}, ${input.timeLabel}`,
		`Where: ${input.location}`,
		`Spots: ${open} of ${input.capacity} open`,
		...(input.notes ? ["", input.notes] : []),
		"",
		`Put your name in: ${rsvpUrl}`,
		...(input.permitUrl ? [`Permit: ${input.permitUrl}`] : []),
		"",
		"Two shirts. Water. Show up.",
		"",
		listFooterText(),
	].join("\n");

	return {
		subject: `Gym booked: ${input.dateLabel} at ${input.timeLabel}`,
		html,
		text,
	};
}
