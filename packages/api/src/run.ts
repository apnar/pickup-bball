/**
 * Facts about the run that the API needs. Copy lives in apps/web/src/content.
 */

/** How many players the run can take before someone sits. */
export const CAPACITY = 10;

/** The gym's timezone. Game dates are calendar days here. */
export const RUN_TIMEZONE = "America/New_York";

/** Today's date in the gym's timezone as YYYY-MM-DD. */
export function todayInRunTimezone(now: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: RUN_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "Mon, Sep 14" for a YYYY-MM-DD date. */
export function formatGameDate(date: string): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "UTC",
		weekday: "short",
		month: "short",
		day: "numeric",
	}).format(new Date(`${date}T12:00:00Z`));
}

/** "7:00 PM" for an HH:MM 24-hour time. */
export function formatGameTime(time: string): string {
	const [h = 0, m = 0] = time.split(":").map(Number);
	const suffix = h >= 12 ? "PM" : "AM";
	const hour12 = h % 12 === 0 ? 12 : h % 12;
	return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Normalises a typed name for the uniqueness key. */
export function nameKeyOf(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Whether a session user may manage games, permits and roles. */
export function isAdmin(
	user: { role?: string | null } | null | undefined,
): boolean {
	return user?.role === "admin";
}
