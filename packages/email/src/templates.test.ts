import { describe, expect, it } from "vitest";

import { escapeHtml, PARAM } from "./render";
import {
	messageEmail,
	type RsvpFacts,
	resetPasswordEmail,
	rsvpCallEmail,
	rsvpConfirmedEmail,
	rsvpFinalEmail,
	rsvpLastCallEmail,
	rsvpNudgeEmail,
	verifyEmail,
	welcomeEmail,
} from "./templates";

const site = "https://moco-pickup.com";

const facts: RsvpFacts = {
	gameId: "g-1",
	dateLabel: "Mon, Sep 14",
	timeLabel: "9:00 PM - 10:30 PM",
	location: "Shady Grove <Middle> School",
	notes: "Park by the side door & bring water",
	siteUrl: site,
	inNames: ["Sean", "Big Ray"],
	maybeNames: ["Pete"],
	inCount: 7,
	confirmAt: 10,
	playAt: 8,
	capacity: 12,
};

describe("the cycle emails", () => {
	const call = rsvpCallEmail({ ...facts, today: false, alreadyOn: false });
	const nudge = rsvpNudgeEmail({ ...facts, needed: 3 });
	const confirmed = rsvpConfirmedEmail({
		...facts,
		inCount: 10,
		permitUrl: `${site}/api/permits/abc/file`,
	});
	const lastCall = rsvpLastCallEmail({
		...facts,
		needed: 2,
		wasConfirmed: false,
	});
	const on = rsvpFinalEmail({
		...facts,
		inCount: 9,
		decision: "on",
		permitUrl: null,
	});
	const off = rsvpFinalEmail({
		...facts,
		inCount: 6,
		decision: "off",
		permitUrl: null,
	});
	const all = [call, nudge, confirmed, lastCall, on, off];

	it("escape whatever an admin typed", () => {
		expect(call.html).toContain("Shady Grove &lt;Middle&gt; School");
		expect(call.html).toContain("side door &amp; bring");
		expect(call.html).not.toContain("<Middle>");
	});

	it("carry the unsubscribe placeholder in both parts", () => {
		for (const r of all) {
			expect(r.html).toContain(PARAM.unsubscribeUrl);
			expect(r.text).toContain(PARAM.unsubscribeUrl);
			expect(r.text.trim().length).toBeGreaterThan(0);
		}
	});

	it("send everyone back through their own sign-in link", () => {
		for (const r of all) {
			expect(r.html).toContain(PARAM.key);
			expect(r.text).toContain(PARAM.key);
		}
	});

	it("offer three answers before the last call and two after", () => {
		for (const answer of ["in", "maybe", "out"]) {
			expect(call.text).toContain(`%2Frsvp%2Fg-1%3Fa%3D${answer}`);
			expect(nudge.text).toContain(`%2Frsvp%2Fg-1%3Fa%3D${answer}`);
		}
		// The last call exists to turn a maybe into a number. Handing back the
		// button that made the problem is how you get to 7:30 with five maybes.
		expect(lastCall.text).not.toContain("%3Fa%3Dmaybe");
		expect(confirmed.text).not.toContain("%3Fa%3Dmaybe");
		// The verdict asks nothing. The question is closed.
		for (const r of [on, off]) {
			expect(r.text).not.toContain("%3Fa%3D");
		}
	});

	it("keep the permit link token-free: gym staff see it", () => {
		expect(confirmed.text).toContain(`${site}/api/permits/abc/file`);
		expect(confirmed.text).not.toContain("/api/permits/abc/file?k=");
	});

	it("say where the count stands", () => {
		expect(call.subject).toBe(
			"Tomorrow, 9:00 PM - 10:30 PM. In, out, or maybe.",
		);
		expect(nudge.subject).toBe("7 in, 3 short. You have not said anything.");
		expect(confirmed.subject).toBe(
			"Run is on. Mon, Sep 14, 9:00 PM - 10:30 PM.",
		);
		expect(lastCall.subject).toBe("Last call: 7 in, 2 short by 7:30.");
		expect(on.subject).toBe("Run is on. 9 in.");
		expect(off.subject).toBe("No run tonight. 6 in.");
		expect(call.text).toContain("Sean, Big Ray");
	});

	it("says tonight when the gym was booked the same day", () => {
		const today = rsvpCallEmail({ ...facts, today: true, alreadyOn: false });
		expect(today.subject).toContain("Tonight");
		expect(today.text).toContain("There is a gym tonight.");
	});

	it("doubles as the confirmation when ten answered before we asked", () => {
		const already = rsvpCallEmail({
			...facts,
			inCount: 11,
			today: false,
			alreadyOn: true,
		});
		expect(already.text).toContain("The run is on.");
	});

	it("tells a sponsor to pass a cancellation on", () => {
		expect(off.text).toContain("Go tell them before they drive over.");
		// The maybes are named on a cancellation: they were waiting on this.
		expect(off.text).toContain("Pete");
	});
});

describe("message", () => {
	const message = messageEmail({
		subject: "Gym closed <tonight>",
		body: "Boiler blew.\n\nSee you next week & bring a jacket.",
		siteUrl: site,
	});
	it("escapes and keeps its footer", () => {
		expect(message.html).toContain("Gym closed &lt;tonight&gt;");
		expect(message.html).toContain(PARAM.unsubscribeUrl);
	});
});

describe("welcome", () => {
	const url = `${site}/api/auth/link?k=abc123&to=%2F%23rsvp`;
	const welcome = welcomeEmail({ name: "Pete", url });

	it("carries a concrete link, not a placeholder", () => {
		expect(welcome.text).toContain(url);
		expect(welcome.html).toContain(escapeHtml(url));
		expect(welcome.html).not.toContain("{{ params");
		expect(welcome.text).not.toContain("{{ params");
	});

	it("says the link is a key and mentions the password option", () => {
		expect(welcome.subject).toBe("You're on the list.");
		expect(welcome.text).toContain("don't forward it");
		expect(welcome.text).toContain("password");
	});
});

describe("auth templates", () => {
	const url = `${site}/api/auth/verify-email?token=x&callbackURL=%2Fdashboard`;
	const verify = verifyEmail({ name: "Kyle <script>", url });
	const reset = resetPasswordEmail({ name: "Pete", url });

	it("have no unsubscribe footer", () => {
		for (const r of [verify, reset]) {
			expect(r.html).not.toContain("{{ params");
			expect(r.text).not.toContain("{{ params");
		}
	});

	it("include the link in both parts and escape names", () => {
		expect(verify.html).toContain(
			'href="https://moco-pickup.com/api/auth/verify-email?token=x&amp;callbackURL=%2Fdashboard"',
		);
		expect(verify.text).toContain(url);
		expect(verify.html).toContain("Kyle &lt;script&gt;");
		expect(reset.text).toContain(url);
	});
});
