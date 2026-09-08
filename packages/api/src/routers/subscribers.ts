import { ORPCError } from "@orpc/server";
import { subscriber } from "@pickup-bball/db/schema/email";
import {
	findSubscriptionForUser,
	setSubscriptionForUser,
	upsertSubscriber,
} from "@pickup-bball/db/subscribers";
import { getMailer } from "@pickup-bball/email/worker";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { isUniqueViolation } from "../db-errors";
import { adminProcedure, protectedProcedure, publicProcedure } from "../index";

const emailSchema = z.email("That is not an email address.").max(254);
const nameSchema = z.string().trim().max(40, "Shorter name, please.");

export const subscribersRouter = {
	/** Join the list from the site. Says yes whether or not the address was new. */
	subscribe: publicProcedure
		.input(z.object({ email: emailSchema, name: nameSchema.optional() }))
		.handler(async ({ context, input }) => {
			try {
				await upsertSubscriber(context.db, {
					email: input.email,
					name: input.name,
					source: "site",
					userId: context.session?.user.id ?? null,
					reactivate: true,
				});
				await getMailer().unblock(input.email);
			} catch (error) {
				// Two people racing on the same address: the row exists, which is fine.
				if (!isUniqueViolation(error)) throw error;
			}
			return { ok: true };
		}),

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
			})
			.from(subscriber)
			.orderBy(asc(subscriber.createdAt))
			.all(),
	),

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
				return result;
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ORPCError("CONFLICT", {
						message: "That address is already on the list.",
					});
				}
				throw error;
			}
		}),

	remove: adminProcedure
		.input(z.object({ id: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			await context.db.delete(subscriber).where(eq(subscriber.id, input.id));
			return { ok: true };
		}),
};
