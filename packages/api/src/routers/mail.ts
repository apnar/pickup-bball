import { ORPCError } from "@orpc/server";
import { EMAIL_AUDIENCES, emailSend } from "@pickup-bball/db/schema/email";
import { game } from "@pickup-bball/db/schema/game";
import { getMailer } from "@pickup-bball/email/worker";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { findGame } from "../games";
import { adminProcedure } from "../index";
import { sendReminderFor } from "../jobs/reminders";
import {
	countRecipients,
	recipientCounts,
	renderAnnouncement,
	renderMessage,
	renderReminder,
	sendToList,
	tokensFor,
} from "../mail";

const gameIdSchema = z.object({ gameId: z.string().min(1) });

const messageSchema = z.object({
	subject: z.string().trim().min(1, "Subject?").max(120),
	body: z.string().trim().min(1, "Say something.").max(5000),
	/**
	 * Who hears it. "active" is everybody on the list; "everyone" also reaches
	 * the people who have stepped away, for the rare thing they would want
	 * anyway ("the season is moving to Thursdays"). Neither reaches anybody
	 * deactivated. Game announcements and reminders never offer the choice.
	 */
	audience: z.enum(EMAIL_AUDIENCES).default("active"),
});

async function requireGame(db: Context["db"], id: string) {
	const found = await findGame(db, id);
	if (!found) {
		throw new ORPCError("NOT_FOUND", { message: "No such game." });
	}
	return found;
}

function nobody(): never {
	throw new ORPCError("BAD_REQUEST", { message: "Nobody is on the list." });
}

export const mailRouter = {
	/** Whether emails actually leave the building (BREVO_API_KEY is set). */
	status: adminProcedure.handler(async ({ context }) => ({
		dryRun: getMailer().dryRun,
		counts: await recipientCounts(context.db),
	})),

	previewAnnouncement: adminProcedure
		.input(gameIdSchema)
		.handler(async ({ context, input }) => {
			const found = await requireGame(context.db, input.gameId);
			return {
				...renderAnnouncement(found),
				recipientCount: await countRecipients(context.db),
				announcedAt: found.announcedAt,
			};
		}),

	/**
	 * Email the list about a game. With `subscriberIds` it goes only to those
	 * people (a resend) and does not mark the game announced.
	 */
	sendAnnouncement: adminProcedure
		.input(
			gameIdSchema.extend({
				personIds: z.array(z.string().min(1)).min(1).optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const found = await requireGame(context.db, input.gameId);
			const result = await sendToList(context.db, {
				kind: "announcement",
				gameId: found.id,
				rendered: renderAnnouncement(found),
				sentBy: context.session.user.id,
				onlyPersonIds: input.personIds,
			});
			if (!result) nobody();
			if (!input.personIds && result.sent > 0) {
				await context.db
					.update(game)
					.set({ announcedAt: new Date() })
					.where(eq(game.id, found.id));
			}
			return result;
		}),

	previewReminder: adminProcedure
		.input(gameIdSchema)
		.handler(async ({ context, input }) => {
			const found = await requireGame(context.db, input.gameId);
			return {
				...(await renderReminder(context.db, found)),
				recipientCount: await countRecipients(context.db),
				reminderSentAt: found.reminderSentAt,
			};
		}),

	/** Send the game-day reminder now, if it has not gone out already. */
	sendReminder: adminProcedure
		.input(gameIdSchema)
		.handler(async ({ context, input }) => {
			await requireGame(context.db, input.gameId);
			const outcome = await sendReminderFor(context.db, input.gameId);
			if (!outcome) {
				throw new ORPCError("CONFLICT", {
					message: "That reminder already went out.",
				});
			}
			if (outcome.recipients === 0) nobody();
			return outcome;
		}),

	previewMessage: adminProcedure
		.input(messageSchema)
		.handler(async ({ context, input }) => ({
			...renderMessage(input),
			recipientCount: await countRecipients(context.db, input.audience),
		})),

	/** Send an ad hoc message to the list, or only to yourself as a test. */
	sendMessage: adminProcedure
		.input(messageSchema.extend({ toSelf: z.boolean().default(false) }))
		.handler(async ({ context, input }) => {
			const rendered = renderMessage(input);
			if (input.toSelf) {
				const me = context.session.user;
				// The test copy has to render its links like the real thing. The
				// admin is a person like everybody else now, so their own tokens
				// are already sitting on their row.
				const { key, unsubscribeUrl } = await tokensFor(context.db, me.id);
				const outcome = await getMailer().sendOne(
					{ email: me.email, name: me.name },
					rendered,
					{
						tags: ["message", "test"],
						params: { name: me.name, unsubscribeUrl, key },
					},
				);
				if (!outcome.ok) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: `Brevo said no: ${outcome.error}`,
					});
				}
				return {
					attempted: 1,
					sent: 1,
					failed: [],
					messageIds: [outcome.messageId],
					sendId: null,
				};
			}
			const result = await sendToList(context.db, {
				kind: "message",
				rendered,
				sentBy: context.session.user.id,
				audience: input.audience,
			});
			if (!result) nobody();
			return result;
		}),

	/** The last few list sends, newest first. */
	recent: adminProcedure.handler(async ({ context }) => {
		const rows = await context.db
			.select()
			.from(emailSend)
			.orderBy(desc(emailSend.createdAt))
			.limit(20)
			.all();
		return rows.map((row) => ({
			...row,
			messageIds: JSON.parse(row.messageIds) as string[],
			errors: JSON.parse(row.errors) as { emails: string[]; error: string }[],
		}));
	}),
};
