import type { Rendered } from "../brevo";
import { layout, listFooter, listFooterText, paragraphs } from "../render";

export type MessageInput = {
	subject: string;
	body: string;
};

/** Whatever an admin typed, sent to the whole list. */
export function messageEmail(input: MessageInput): Rendered {
	const html = layout({
		title: input.subject,
		kicker: "From the front office",
		heading: input.subject,
		bodyHtml: paragraphs(input.body),
		footerHtml: listFooter(),
	});
	const text = [input.body.trim(), "", listFooterText()].join("\n");
	return { subject: input.subject, html, text };
}
