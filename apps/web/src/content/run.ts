/**
 * Copy and standing data for the site. Edit here; the pages read from it.
 */

export const SITE_NAME = "Sean's Monday Night Run";

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
		val: "Redland or Shady Grove Middle Schools",
		rem: "Whichever one the permit says. The sheet for the week names it.",
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
		body: "Win by two. The last game of the night is the exception: it ends when the gym does, not when somebody gets to 15.",
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
		title: "Four on four, nothing over half",
		body: "Short-handed nights, the ball gets dribbled across half court. No long outlet to the guy who quit on defense and left early.",
	},
	{
		num: "07",
		title: "The colored bars are in",
		body: "Those fat painted stripes down the sidelines play as in bounds. The baseline is still the baseline, so do not get inventive back there.",
	},
] as const;
