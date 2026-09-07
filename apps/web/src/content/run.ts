/**
 * Copy and standing data for the site. Edit here; the pages read from it.
 */

export const SITE_NAME = "Sean's Monday Night Run";

/** Prefilled court when an admin books a game. */
export const DEFAULT_LOCATION = "Shady Grove Middle School";

/** Prefilled tip-off time (24-hour) when an admin books a game. */
export const DEFAULT_START_TIME = "21:00";

/** Prefilled end time (24-hour) when an admin books a game. */
export const DEFAULT_END_TIME = "22:30";

export const conditions = [
	{
		num: "01",
		prop: "Day",
		val: "Monday",
		rem: "Every one of them. Holidays are not an excuse.",
	},
	{
		num: "02",
		prop: "Tip-off",
		val: "9:00 - 10:30 PM",
		rem: '"Sharp." Layup lines start at 9:15 when Dev arrives.',
	},
	{
		num: "03",
		prop: "Court",
		val: "Shady Grove Middle School",
		rem: "The gym, not the cafeteria. Park by the side door.",
	},
	{
		num: "04",
		prop: "Format",
		val: "5v5 · to 15",
		rem: "Twos and threes, win by two, winners stay.",
	},
	{
		num: "05",
		prop: "Ball",
		val: "Sean's",
		rem: "Do not kick it. Do not sit on it. Do not lose it.",
	},
] as const;

export type RosterStatus = "Founder" | "Regular" | "Probation";

export const roster = [
	{
		num: "01",
		name: "Sean",
		pos: "Point / Commissioner",
		since: "2017",
		report:
			"Runs the group chat and the offense. Calls fouls no one else saw. Hip status: classified.",
		status: "Founder",
	},
	{
		num: "02",
		name: "Marcus",
		pos: "Wing",
		since: "2017",
		report:
			"Shoots it from anywhere and means it. Passes once a quarter, as a treat.",
		status: "Regular",
	},
	{
		num: "03",
		name: "Big Ray",
		pos: "Center",
		since: "2018",
		report:
			"Sets screens that count as assault in three states. Has never left the paint.",
		status: "Regular",
	},
	{
		num: "04",
		name: "Dev",
		pos: "Guard",
		since: "2018",
		report:
			"Fastest guy here. Also the latest guy here. Arrives mid-warmup, leaves mid-argument.",
		status: "Regular",
	},
	{
		num: "05",
		name: "Kyle",
		pos: "Forward",
		since: "2019",
		report:
			"Brings both shirts every week and reminds you that he brought both shirts.",
		status: "Regular",
	},
	{
		num: "06",
		name: "Jamal",
		pos: "Wing",
		since: "2020",
		report:
			"Plays real defense, which is considered rude here. Tolerated because he rebounds.",
		status: "Regular",
	},
	{
		num: "07",
		name: "Tony",
		pos: "Guard",
		since: "2021",
		report: "Claims a 40-inch vertical. Evidence remains under review.",
		status: "Probation",
	},
	{
		num: "08",
		name: "Pete",
		pos: "Whatever is open",
		since: "2022",
		report: 'Says "my bad" 30 times a night. Is, in fact, always his bad.',
		status: "Regular",
	},
] as const satisfies readonly {
	num: string;
	name: string;
	pos: string;
	since: string;
	report: string;
	status: RosterStatus;
}[];

export const rules = [
	{
		num: "01",
		title: "Call your own fouls",
		body: "Then live with the shame. The offense calls it, the defense complains about it, the game moves on.",
	},
	{
		num: "02",
		title: "Winners stay",
		body: "Losers shoot for next. Free throws only. Airballs forfeit your spot to whoever laughed loudest.",
	},
	{
		num: "03",
		title: "Twos and threes, to 15",
		body: 'Win by two. There is no "one more" once someone has left to get their kid.',
	},
	{
		num: "04",
		title: "Sean's ball, Sean's rules",
		body: "Sean's hip also gets a vote. When the hip goes, the run goes. Do not test the hip.",
	},
	{
		num: "05",
		title: "No heat checks before 9:30",
		body: "Nobody has earned a 30-footer at 9:10. Nobody has earned one at 10:15 either, but rules are rules.",
	},
	{
		num: "06",
		title: "Two shirts. Water. Show up.",
		body: "Dark and light. If you show up in gray you are on skins, and nobody wants that for you.",
	},
] as const;
