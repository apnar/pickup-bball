import { describe, expect, it } from "vitest";

import { createMailer } from "./mailer";
import { PARAM, sealTemplate } from "./render";

const ZW = "​";

describe("sealTemplate", () => {
	it("leaves our own placeholders alone", () => {
		const html = `<a href="https://x/api/auth/link?k=${PARAM.key}">${PARAM.name}</a> ${PARAM.unsubscribeUrl}`;
		expect(sealTemplate(html)).toBe(html);
	});

	it("breaks every opener a person could type", () => {
		expect(sealTemplate("{{ contact.EMAIL }}")).toBe(
			`{${ZW}{ contact.EMAIL }}`,
		);
		expect(sealTemplate("{% if x %}y{% endif %}")).toBe(
			`{${ZW}% if x %}y{${ZW}% endif %}`,
		);
		expect(sealTemplate("{# note #}")).toBe(`{${ZW}# note #}`);
		expect(sealTemplate("{{{")).toBe(`{${ZW}{${ZW}{`);
	});

	it("tells a typed brace from a placeholder in the same line", () => {
		const input = `In: {{ params.key }}, ${PARAM.name}`;
		expect(sealTemplate(input)).toBe(
			`In: {${ZW}{ params.key }}, ${PARAM.name}`.replace(
				`{${ZW}{ params.key }}`,
				PARAM.key,
			),
		);
		// A guest literally named after the placeholder is still the
		// placeholder: Brevo fills it with the reader's own values, which leaks
		// nothing across recipients. What matters is nothing else gets through.
		expect(sealTemplate("{{ params.name }}x{{ evil }}")).toBe(
			`${PARAM.name}x{${ZW}{ evil }}`,
		);
	});

	it("leaves ordinary braces and plain text untouched", () => {
		expect(sealTemplate("a { b } c }} d")).toBe("a { b } c }} d");
		expect(sealTemplate("")).toBe("");
	});
});

describe("the mailer seals what it sends", () => {
	it("in the subject, the html and the text, for one and for the list", async () => {
		const bodies: unknown[] = [];
		const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
			bodies.push(JSON.parse(String(init?.body)));
			return new Response(JSON.stringify({ messageId: "m" }), {
				status: 201,
			});
		}) as unknown as typeof fetch;
		const mailer = createMailer({
			apiKey: "k",
			sender: { email: "s@x.com" },
			fetch: fetchImpl,
		});
		const rendered = {
			subject: "{% raw %}",
			html: `<p>${PARAM.name}</p><p>{{ guest }}</p>`,
			text: `${PARAM.unsubscribeUrl}\n{{ guest }}`,
		};
		await mailer.sendOne({ email: "a@x.com" }, rendered);
		await mailer.sendList(
			[{ email: "a@x.com", name: null, unsubscribeUrl: "u", linkToken: "t" }],
			rendered,
		);
		expect(bodies).toHaveLength(2);
		for (const body of bodies as Record<string, string>[]) {
			expect(body.subject).toBe(`{${ZW}% raw %}`);
			expect(body.htmlContent).toBe(
				`<p>${PARAM.name}</p><p>{${ZW}{ guest }}</p>`,
			);
			expect(body.textContent).toBe(
				`${PARAM.unsubscribeUrl}\n{${ZW}{ guest }}`,
			);
		}
	});
});
