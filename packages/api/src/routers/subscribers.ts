import { ORPCError } from "@orpc/server";
import { subscriber } from "@pickup-bball/db/schema/email";
import {
	findActiveSubscriberByEmail,
	findSubscriptionForUser,
	setSubscriptionForUser,
	upsertSubscriber,
} from "@pickup-bball/db/subscribers";
import { getMailer } from "@pickup-bball/email/worker";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { isUniqueViolation } from "../db-errors";
import { adminProcedure, protectedProcedure, publicProcedure } from "../index";
import { sendWelcome } from "../mail";

const emailSchema = z.email("That is not an email address.").max(254);
const nameSchema = z.string().trim().max(40, "Shorter name, please.");

export const subscribersRouter = {
	/** The signed-in user's own subscription state. */
	mine: protectedProcedure.handler(async ({ context }) => {
		const row = await findSubscriptionForUser(context.db, {
			userId: context.session.user.id,
			email: context.session.user.email,
		});
		return { subscribed: row?.status === "active" };
	}),

	setMine: protectedProcedure
		.input(z.object({ subscribed: z.boolean() }))
		.handler(async ({ context, input }) => {
			await setSubscriptionForUser(context.db, {
				userId: context.session.user.id,
				email: context.session.user.email,
				name: context.session.user.name,
				subscribed: input.subscribed,
			});
			if (input.subscribed) {
				await getMailer().unblock(context.session.user.email);
			}
			return { subscribed: input.subscribed };
		}),

	list: adminProcedure.handler(({ context }) =>
		context.db
			.select({
				id: subscriber.id,
				email: subscriber.email,
				name: subscriber.name,
				status: subscriber.status,
				source: subscriber.source,
				createdAt: subscriber.createdAt,
				unsubscribedAt: subscriber.unsubscribedAt,
				userId: subscriber.userId,
				linkSentAt: subscriber.linkSentAt,
			})
			.from(subscriber)
			.orderBy(asc(subscriber.createdAt))
			.all(),
	),

	/** Add somebody to the list and email them their way in. Admin only. */
	add: adminProcedure
		.input(z.object({ email: emailSchema, name: nameSchema.optional() }))
		.handler(async ({ context, input }) => {
			try {
				const result = await upsertSubscriber(context.db, {
					email: input.email,
					name: input.name,
					source: "admin",
					reactivate: true,
				});
				await getMailer().unblock(input.email);
				const outcome = await sendWelcome(context.db, result.id, {
					email: input.email,
					name: input.name ?? null,
				});
				return { ...result, emailed: outcome.ok, dryRun: getMailer().dryRun };
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ORPCError("CONFLICT", {
						message: "That address is already on the list.",
					});
				}
				throw error;
			}
		}),

	/** Send someone their sign-in link again. Admin only. */
	sendLink: adminProcedure
		.input(z.object({ id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const row = await context.db
				.select({
					id: subscriber.id,
					email: subscriber.email,
					name: subscriber.name,
					status: subscriber.status,
				})
				.from(subscriber)
				.where(eq(subscriber.id, input.id))
				.get();
			if (!row) {
				throw new ORPCError("NOT_FOUND", { message: "Nobody by that id." });
			}
			if (row.status !== "active") {
				throw new ORPCError("BAD_REQUEST", {
					message: "They unsubscribed. Add them back first.",
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
	 * "Email me my link" from the login page. Says the same thing whether or
	 * not the address is on the list, and refuses to be a mail cannon.
	 */
	requestLink: publicProcedure
		.input(z.object({ email: emailSchema }))
		.handler(async ({ context, input }) => {
			const row = await findActiveSubscriberByEmail(context.db, input.email);
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

	remove: adminProcedure
		.input(z.object({ id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await context.db.delete(subscriber).where(eq(subscriber.id, input.id));
			return { ok: true };
		}),
};
