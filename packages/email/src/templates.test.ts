import { describe, expect, it } from "vitest";

import { escapeHtml, PARAM } from "./render";
import {
	announcementEmail,
	messageEmail,
	reminderEmail,
	resetPasswordEmail,
	verifyEmail,
	welcomeEmail,
} from "./templates";

const site = "https://moco-pickup.com";

describe("list templates", () => {
	const announcement = announcementEmail({
		dateLabel: "Mon, Sep 14",
		timeLabel: "9:00 PM - 10:30 PM",
		location: "Shady Grove <Middle> School",
		notes: "Park by the side door & bring both shirts",
		permitUrl: `${site}/api/permits/abc/file`,
		siteUrl: site,
		inCount: 4,
		capacity: 10,
	});
	const reminder = reminderEmail({
		dateLabel: "Mon, Sep 14",
		timeLabel: "9:00 PM",
		location: "Shady Grove",
		inCount: 7,
		capacity: 10,
		inNames: ["Sean", "Big Ray"],
		siteUrl: site,
	});
	const message = messageEmail({
		subject: "Gym closed <tonight>",
		body: "Boiler blew.\n\nSee you next week & bring a jacket.",
		siteUrl: site,
	});

	it("escape user content", () => {
		expect(announcement.html).toContain("Shady Grove &lt;Middle&gt; School");
		expect(announcement.html).toContain("side door &amp; bring");
		expect(announcement.html).not.toContain("<Middle>");
		expect(message.html).toContain("Gym closed &lt;tonight&gt;");
		expect(message.html).toContain("<p");
	});

	it("carry the unsubscribe placeholder in both parts", () => {
		for (const r of [announcement, reminder, message]) {
			expect(r.html).toContain(PARAM.unsubscribeUrl);
			expect(r.text).toContain(PARAM.unsubscribeUrl);
			expect(r.text.trim().length).toBeGreaterThan(0);
		}
	});

	it("send everyone back through their own sign-in link", () => {
		for (const r of [announcement, reminder, message]) {
			expect(r.html).toContain(PARAM.key);
			expect(r.text).toContain(PARAM.key);
			expect(r.html).not.toContain(`${site}/#rsvp`);
			expect(r.text).not.toContain(`${site}/#rsvp`);
		}
	});

	it("keep the permit link token-free: gym staff see it", () => {
		expect(announcement.text).toContain(`${site}/api/permits/abc/file`);
		expect(announcement.text).not.toContain(`${site}/api/permits/abc/file?k=`);
	});

	it("describe the game", () => {
		expect(announcement.subject).toBe(
			"Gym booked: Mon, Sep 14 at 9:00 PM - 10:30 PM",
		);
		expect(announcement.text).toContain("6 of 10 open");
		expect(reminder.subject).toBe("Tonight: 7 in, 3 spots left");
		expect(reminder.text).toContain("Sean, Big Ray");
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
