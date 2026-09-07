/**
 * Facts about the run that the API needs. Copy lives in apps/web/src/content.
 */

/** How many players the run can take before someone sits. */
export const CAPACITY = 10;

/** The gym's timezone. The week rolls over at midnight here, after Monday. */
export const RUN_TIMEZONE = "America/New_York";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The Monday this headcount is for, as YYYY-MM-DD. On a Monday it is that
 * day (the run has not happened yet, or is happening); from Tuesday on it is
 * the coming Monday.
 */
export function currentWeekOf(now: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: RUN_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "short",
	}).formatToParts(now);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";
	const year = Number(get("year"));
	const month = Number(get("month"));
	const day = Number(get("day"));
	const weekday = WEEKDAYS.indexOf(get("weekday"));
	const daysUntilMonday = (8 - weekday) % 7;
	const monday = new Date(Date.UTC(year, month - 1, day + daysUntilMonday));
	return monday.toISOString().slice(0, 10);
}

/** "Mon, Sep 14" for a YYYY-MM-DD week key. */
export function formatWeekOf(weekOf: string): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "UTC",
		weekday: "short",
		month: "short",
		day: "numeric",
	}).format(new Date(`${weekOf}T12:00:00Z`));
}

/** Normalises a typed name for the uniqueness key. */
export function nameKeyOf(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}
