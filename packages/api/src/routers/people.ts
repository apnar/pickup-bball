import { ORPCError } from "@orpc/server";
import { createAuth } from "@pickup-bball/auth";
import { APIError } from "@pickup-bball/auth/errors";
import {
	deactivate,
	effectiveStatus,
	findPersonState,
	findReachablePersonByEmail,
	listPeople,
	reactivate,
	suspend,
	unsuspend,
} from "@pickup-bball/db/people";
import { getMailer } from "@pickup-bball/email/worker";
import { z } from "zod";

import type { Context } from "../context";
import { adminProcedure, protectedProcedure, publicProcedure } from "../index";
import { sendWelcome } from "../mail";
import { isAdmin } from "../run";

const emailSchema = z.email("That is not an email address.").max(254);
const nameSchema = z.string().trim().max(40, "Shorter name, please.");
/** Short on purpose: this is "torn calf, back in a month", not a letter. */
const reasonSchema = z.string().trim().max(200, "Keep it short.").optional();

const suspendInput = z.object({
	userId: z.string().min(1).optional(),
	reason: reasonSchema,
	/** Milliseconds since the epoch. Absent means "until they say otherwise". */
	until: z.number().int().positive().optional(),
});

/**
 * Resolve who a self-or-admin action is aimed at. Acting on yourself is
 * always allowed; acting on anybody else is an admin's business.
 */
function targetOf(context: Context, userId: string | undefined): string {
	const me = context.session?.user;
	if (!me) throw new ORPCError("UNAUTHORIZED");
	if (!userId || userId === me.id) return me.id;
	if (!isAdmin(me)) {
		throw new ORPCError("FORBIDDEN", {
			message: "That is not your account to pause.",
		});
	}
	return userId;
}

async function requirePerson(db: Context["db"], userId: string) {
	const state = await findPersonState(db, userId);
	if (!state)
		throw new ORPCError("NOT_FOUND", { message: "Nobody by that id." });
	return state;
}

/**
 * Everybody who plays. One table, one status: the mailing list and the roster
 * are the same list of people, and stepping away is a state on it rather than
 * a row in some other table.
 */
export const peopleRouter = {
	/** The caller's own status, for the dashboard and the RSVP board. */
	me: protectedProcedure.handler(async ({ context }) => {
		const state = await requirePerson(context.db, context.session.user.id);
		return {
			status: effectiveStatus(state),
			suspendedUntil: state.suspendedUntil,
			reason: state.statusReason,
		};
	}),

	/**
	 * Step away for a while. Self-service, or an admin doing it for somebody
	 * who phoned it in. Never touches a deactivated account.
	 */
	suspend: protectedProcedure
		.input(suspendInput)
		.handler(async ({ context, input }) => {
			const userId = targetOf(context, input.userId);
			const state = await requirePerson(context.db, userId);
			if (state.status === "deactivated") {
				throw new ORPCError("BAD_REQUEST", {
					message: "That account is deactivated. Reactivate it first.",
				});
			}
			await suspend(context.db, {
				userId,
				reason: input.reason,
				until: input.until ? new Date(input.until) : null,
				by: userId === context.session.user.id ? "self" : "admin",
			});
			return { ok: true };
		}),

	/** Back on the list. Lifts a suspension only; a ban needs an admin. */
	unsuspend: protectedProcedure
		.input(z.object({ userId: z.string().min(1).optional() }))
		.handler(async ({ context, input }) => {
			const userId = targetOf(context, input.userId);
			const state = await requirePerson(context.db, userId);
			if (state.status === "deactivated") {
				throw new ORPCError("FORBIDDEN", {
					message:
						"That account is deactivated. An admin has to reactivate it.",
				});
			}
			await unsuspend(context.db, userId);
			// They may be on Brevo's blocklist from a webhook drop; without this
			// they would be "active" and quietly undeliverable. Their address,
			// not the caller's -- an admin can do this for somebody else.
			await getMailer().unblock(state.email);
			return { ok: true };
		}),

	list: adminProcedure.handler(({ context }) => listPeople(context.db)),

	/** Add somebody and email them their way in. Admin only. */
	add: adminProcedure
		.input(z.object({ email: emailSchema, name: nameSchema.optional() }))
		.handler(async ({ context, input }) => {
			const email = input.email.trim().toLowerCase();
			const name = input.name?.trim() || email.split("@")[0] || email;
			let userId: string;
			try {
				// The admin plugin lower-cases the address, rejects a duplicate and
				// applies the default role. Password is optional -- most players
				// never set one -- and it sends no verification email, so nothing
				// races the welcome. The create hook stamps their tokens.
				const result = await createAuth().api.createUser({
					// `source` and `status` are left to their column defaults
					// ("admin", "active"), which is exactly this path. Better Auth
					// drops fields it does not know about, so setting them here
					// would look like it worked and quietly do nothing.
					body: { email, name, data: { emailVerified: false } },
					headers: context.headers,
				});
				userId = result.user.id;
			} catch (error) {
				if (error instanceof APIError) {
					throw new ORPCError("CONFLICT", {
						message: "That address is already on the list.",
					});
				}
				throw error;
			}
			await getMailer().unblock(email);
			const outcome = await sendWelcome(context.db, userId, { email, name });
			return {
				id: userId,
				emailed: outcome.ok,
				dryRun: getMailer().dryRun,
			};
		}),

	/** Send someone their sign-in link again. Admin only. */
	sendLink: adminProcedure
		.input(z.object({ userId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const people = await listPeople(context.db);
			const row = people.find((p) => p.id === input.userId);
			if (!row) {
				throw new ORPCError("NOT_FOUND", { message: "Nobody by that id." });
			}
			if (row.status === "deactivated") {
				throw new ORPCError("BAD_REQUEST", {
					message: "They are deactivated. Reactivate them first.",
				});
			}
			const outcome = await sendWelcome(context.db, row.id, row);
			if (!outcome.ok) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: `Brevo said no: ${outcome.error}`,
				});
			}
			return { ok: true, dryRun: getMailer().dryRun };
		}),

	/**
	 * Out of the group: no email of any kind, no way in, every session killed.
	 * Admin only, and the only thing that sets Better Auth's `banned`, which is
	 * what closes the password door.
	 */
	deactivate: adminProcedure
		.input(z.object({ userId: z.string().min(1), reason: reasonSchema }))
		.handler(async ({ context, input }) => {
			if (input.userId === context.session.user.id) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Find another admin to do that to you.",
				});
			}
			await requirePerson(context.db, input.userId);
			await deactivate(context.db, input);
			await createAuth().api.revokeUserSessions({
				body: { userId: input.userId },
				headers: context.headers,
			});
			return { ok: true };
		}),

	/** Undo a deactivation. Admin only; the only path that clears `banned`. */
	reactivate: adminProcedure
		.input(z.object({ userId: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const state = await requirePerson(context.db, input.userId);
			if (state.status !== "deactivated") {
				throw new ORPCError("BAD_REQUEST", {
					message: "They are not deactivated.",
				});
			}
			await reactivate(context.db, input.userId);
			return { ok: true };
		}),

	/**
	 * "Email me my link" from the login page. Says the same thing whether or
	 * not the address is one of ours, and refuses to be a mail cannon. Serves
	 * suspended people too: mailing themselves a link is how they come back.
	 */
	requestLink: publicProcedure
		.input(z.object({ email: emailSchema }))
		.handler(async ({ context, input }) => {
			const row = await findReachablePersonByEmail(context.db, input.email);
			const cooledOff =
				!row?.linkSentAt || Date.now() - row.linkSentAt.getTime() > 10 * 60_000;
			if (row && cooledOff) {
				await sendWelcome(context.db, row.id, {
					email: input.email,
					name: null,
				});
			}
			return { ok: true };
		}),
};
