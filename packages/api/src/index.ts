import { ORPCError, os } from "@orpc/server";
import { effectiveStatus, findPersonState } from "@pickup-bball/db/people";

import type { Context } from "./context";
import { isAdmin } from "./run";

export const o = os.$context<Context>();

export const publicProcedure = o;

/**
 * The person behind the cookie, as D1 has them right now. The session cookie
 * caches the user for five minutes, so on its own it would keep answering
 * for somebody deactivated or demoted a minute ago -- with the gym address,
 * the schedule and, for an admin, the whole list. One point read per call
 * closes that window; nothing downstream has to remember to.
 */
async function currentPerson(context: Context) {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	const person = await findPersonState(context.db, context.session.user.id);
	if (!person || effectiveStatus(person) === "deactivated") {
		throw new ORPCError("UNAUTHORIZED");
	}
	return { session: context.session, person };
}

const requireAuth = o.middleware(async ({ context, next }) => {
	return next({ context: await currentPerson(context) });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

const requireAdmin = o.middleware(async ({ context, next }) => {
	const current = await currentPerson(context);
	// The role from the row, not from the cookie: a demotion has to mean
	// something before the cache runs out.
	if (!isAdmin(current.person)) {
		throw new ORPCError("FORBIDDEN", {
			message: "Admins only. Ask Sean.",
		});
	}
	return next({ context: current });
});

export const adminProcedure = publicProcedure.use(requireAdmin);
