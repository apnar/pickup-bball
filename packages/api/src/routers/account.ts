import { ORPCError } from "@orpc/server";
import { createAuth } from "@pickup-bball/auth";
import { APIError } from "@pickup-bball/auth/errors";
import { hasPassword } from "@pickup-bball/db/people";
import { z } from "zod";

import { protectedProcedure } from "../index";

/**
 * A player's own account. Passwords are optional here: the emailed links are
 * the way most people get in, and they keep working either way.
 */
export const accountRouter = {
	/** Whether the caller has a password at all. */
	hasPassword: protectedProcedure.handler(async ({ context }) => ({
		hasPassword: await hasPassword(context.db, context.session.user.id),
	})),

	/** Set a first password. Changing an existing one goes through the client. */
	setPassword: protectedProcedure
		.input(z.object({ newPassword: z.string().min(8) }))
		.handler(async ({ context, input }) => {
			try {
				await createAuth().api.setPassword({
					body: { newPassword: input.newPassword },
					headers: context.headers,
				});
			} catch (error) {
				// PASSWORD_TOO_SHORT, PASSWORD_ALREADY_SET and friends.
				if (error instanceof APIError) {
					throw new ORPCError("BAD_REQUEST", {
						message: error.message || "That password did not take.",
					});
				}
				throw error;
			}
			return { hasPassword: true };
		}),
};
